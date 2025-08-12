"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useMutation,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { SignInButton } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";
import { StackBlitzEditor } from "@/components/StackBlitzEditor";
import { useStreamingGeneration } from "@/hooks/use-streaming-generation";

export default function ProjectDetail({ params }: { params: { id: string } }) {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Authenticated>
          <ProjectContent id={params.id} />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">Please sign in to view project details.</p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function ProjectContent({ id }: { id: string }) {
  // Convert string ID to Convex ID
  const projectId = id as unknown as Id<"projects">;

  const project = useQuery(api.projects.get, { id: projectId });
  const artifacts = useQuery(api.artifacts.byProject, { projectId });
  const runs = useQuery(api.runs.byProject, { projectId });
  const createRun = useMutation(api.runs.create);

  const [error, setError] = useState("");
  const [currentRunId, setCurrentRunId] = useState<Id<"runs"> | null>(null);

  // Initialize streaming hook
  const streaming = useStreamingGeneration(currentRunId);

  // Set the latest run ID when runs data is loaded
  useEffect(() => {
    if (runs && runs.length > 0 && currentRunId === null) {
      const latestRun = runs[0];

      // Check if there's an in-progress run and track it
      if (["planning", "generating", "validating"].includes(latestRun.status)) {
        setCurrentRunId(latestRun._id);
      } else if (
        latestRun.status === "completed" &&
        Date.now() - latestRun.createdAt < 10000
      ) {
        // If a run completed in the last 10 seconds, still show its status
        setCurrentRunId(latestRun._id);
      }
    }
  }, [runs, currentRunId]);

  // Auto-start streaming for new runs that are just created
  useEffect(() => {
    if (currentRunId && !streaming.isStreaming && runs) {
      const currentRun = runs.find((run) => run._id === currentRunId);

      // Only start streaming for truly in-progress runs, not completed ones
      // Also check if streaming is already complete to avoid restarting
      if (
        currentRun &&
        ["planning", "generating", "validating"].includes(currentRun.status) &&
        !streaming.isComplete
      ) {
        // Start streaming generation with a default spec (the actual spec is handled server-side)
        streaming
          .startGeneration(
            projectId,
            "", // Empty spec since API gets it from the run
            "gpt-3.5-turbo"
          )
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Generation failed");
          });
      }
    }
  }, [
    currentRunId,
    streaming.isStreaming,
    streaming.isComplete,
    runs,
    projectId,
  ]);

  if (project === undefined || artifacts === undefined || runs === undefined) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>

        <Skeleton className="h-8 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return notFound();
  }

  const handleRegenerate = async () => {
    setError("");

    try {
      // Create a new run first
      const runId = await createRun({
        projectId,
        model: "gpt-3.5-turbo",
        promptVersion: "v1",
        inputSpec: "Todo app with title and done fields", // For regeneration, use a default or get from user
      });

      setCurrentRunId(runId);

      // The auto-start useEffect will handle starting the streaming
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      setError(errorMessage);
    }
  };

  // Get the latest run status
  const latestRun = runs && runs.length > 0 ? runs[0] : null;
  const isRunInProgress =
    latestRun &&
    ["planning", "generating", "validating"].includes(latestRun.status);

  // Determine which files to show (streaming files take precedence)
  const activeFiles = streaming.isStreaming ? streaming.files : {};
  const hasStreamingFiles = Object.keys(activeFiles).length > 0;

  return (
    <div className="max-w-6xl mx-auto text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void handleRegenerate()}
            disabled={streaming.isStreaming || !!isRunInProgress}
          >
            {streaming.isStreaming ? "Generating..." : "Regenerate App"}
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${id}/evals`}>View Evaluations</Link>
          </Button>
        </div>
      </div>

      {/* Streaming status */}
      {(streaming.isStreaming || streaming.isReconnecting) && (
        <div
          className={`border px-4 py-3 rounded mb-6 ${
            streaming.isReconnecting
              ? "bg-yellow-50 border-yellow-200 text-yellow-700"
              : "bg-blue-50 border-blue-200 text-blue-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">
                {streaming.isReconnecting
                  ? `Reconnecting... (Attempt ${streaming.retryCount}/3)`
                  : streaming.currentPhase}
              </span>
              {streaming.currentMessage && (
                <span className="ml-2 text-sm">{streaming.currentMessage}</span>
              )}
            </div>
            <div
              className={`animate-spin rounded-full h-4 w-4 border-b-2 ${
                streaming.isReconnecting
                  ? "border-yellow-600"
                  : "border-blue-600"
              }`}
            ></div>
          </div>

          {/* Progress Bar */}
          {streaming.progress && !streaming.isReconnecting && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-blue-600 mb-1">
                <span>
                  Files: {streaming.progress.current} /{" "}
                  {streaming.progress.total}
                </span>
                <span>{streaming.progress.percentage}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${streaming.progress.percentage}%` }}
                ></div>
              </div>
            </div>
          )}

          {streaming.planContent && (
            <div className="mt-2 text-sm">
              <details className="cursor-pointer">
                <summary>View Plan</summary>
                <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-32">
                  {streaming.planContent}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {(error || streaming.error) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error || streaming.error}
        </div>
      )}

      <Tabs defaultValue="artifacts">
        <TabsList className="mb-6">
          <TabsTrigger value="artifacts">
            Artifacts ({artifacts?.length || 0})
            {hasStreamingFiles && (
              <span className="ml-1 text-blue-600">
                +{Object.keys(activeFiles).length} streaming
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs">Runs ({runs?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts">
          <StackBlitzEditor
            artifacts={artifacts}
            projectName={project.name}
            streamingFiles={activeFiles}
            isGenerating={streaming.isStreaming}
            currentFile={streaming.currentFile || undefined}
            newlyCreatedFiles={streaming.newlyCreatedFiles}
          />
        </TabsContent>

        <TabsContent value="runs">
          <RunsTab runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RunsTab({ runs }: { runs: any[] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-medium mb-2">No runs yet</h2>
        <p className="text-gray-500">
          Click &quot;Regenerate App&quot; to start a new run.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => {
        const statusColors = {
          planning: "bg-blue-100 text-blue-800",
          generating: "bg-yellow-100 text-yellow-800",
          validating: "bg-purple-100 text-purple-800",
          completed: "bg-green-100 text-green-800",
          failed: "bg-red-100 text-red-800",
        };

        const statusColor =
          statusColors[run.status as keyof typeof statusColors] ||
          "bg-gray-100";

        return (
          <Card key={run._id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-1 rounded ${statusColor} capitalize`}
                    >
                      {run.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDistanceToNow(run.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-sm">
                    Model: <span className="font-medium">{run.model}</span> •
                    Prompt:{" "}
                    <span className="font-medium">{run.promptVersion}</span>
                  </div>
                </div>

                {run.tokenUsage && (
                  <div className="text-right text-sm">
                    <div>
                      Tokens:{" "}
                      <span className="font-medium">
                        {run.tokenUsage.toLocaleString()}
                      </span>
                    </div>
                    {run.cost && (
                      <div>
                        Cost:{" "}
                        <span className="font-medium">
                          ${run.cost.toFixed(3)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {run.timings && (
                <div className="text-xs text-gray-500 mt-2">
                  {run.timings.planMs && (
                    <span className="mr-3">
                      Planning: {(run.timings.planMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {run.timings.genMs && (
                    <span className="mr-3">
                      Generation: {(run.timings.genMs / 1000).toFixed(1)}s
                    </span>
                  )}
                  {run.timings.validateMs && (
                    <span>
                      Validation: {(run.timings.validateMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}

              {run.error && (
                <div className="mt-3 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
                  {run.error}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
