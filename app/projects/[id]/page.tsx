"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useAction,
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
import { useRunStatus } from "@/hooks/use-run-status";
import { CodeHighlight } from "@/components/ui/code-highlight";

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
  const runAgent = useAction(api.agent.run);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [currentRunId, setCurrentRunId] = useState<Id<"runs"> | undefined>(
    undefined
  );

  // Set the latest run ID when runs data is loaded
  useEffect(() => {
    if (runs && runs.length > 0) {
      const latestRun = runs[0];

      // Check if there's an in-progress run and track it
      if (["planning", "generating", "validating"].includes(latestRun.status)) {
        console.log(
          "Found in-progress run:",
          latestRun._id,
          "with status:",
          latestRun.status
        );
        setCurrentRunId(latestRun._id);
      } else if (
        latestRun.status === "completed" &&
        Date.now() - latestRun.createdAt < 10000
      ) {
        // If a run completed in the last 10 seconds, still show its status
        console.log("Found recently completed run:", latestRun._id);
        setCurrentRunId(latestRun._id);
      }
    }
  }, [runs]);

  // Use the run status hook to show toast notifications
  useRunStatus(currentRunId);

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
    setIsGenerating(true);
    setError("");

    try {
      // For MVP, we'll use a fixed spec, model and prompt version
      console.log("Starting regeneration for project:", projectId);
      const result = await runAgent({
        projectId,
        inputSpec: "Todo app with title and done fields",
        model: "gpt-4-turbo",
        promptVersion: "v1",
      });

      console.log("Regeneration result:", result);

      // Store the run ID to track status
      if (result && result.runId) {
        console.log("Setting current run ID for regeneration:", result.runId);
        setCurrentRunId(result.runId);

        // Wait longer to ensure statuses change and toasts appear
        setTimeout(() => {
          console.log("Regeneration completed with delay");
        }, 3000); // Increased to 3 seconds
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      console.error("Error during regeneration:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Get the latest run status
  const latestRun = runs && runs.length > 0 ? runs[0] : null;
  const isRunInProgress =
    latestRun &&
    ["planning", "generating", "validating"].includes(latestRun.status);

  return (
    <div className="max-w-6xl mx-auto text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRegenerate}
            disabled={isGenerating || !!isRunInProgress}
          >
            {isGenerating ? "Regenerating..." : "Regenerate App"}
          </Button>
          <Button asChild>
            <Link href={`/preview?projectId=${id}`}>Preview App</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${id}/evals`}>View Evaluations</Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <Tabs defaultValue="artifacts">
        <TabsList className="mb-6">
          <TabsTrigger value="artifacts">
            Artifacts ({artifacts?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="runs">Runs ({runs?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="artifacts">
          <ArtifactsTab artifacts={artifacts} />
        </TabsContent>

        <TabsContent value="runs">
          <RunsTab runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArtifactsTab({ artifacts }: { artifacts: any[] }) {
  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-medium mb-2">No artifacts yet</h2>
        <p className="text-gray-500">
          Run the agent to generate app artifacts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-black">
      {artifacts.map((artifact) => (
        <Card key={artifact._id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span className="font-mono text-sm">{artifact.path}</span>
              <span className="text-xs font-normal bg-gray-100 px-2 py-1 rounded">
                v{artifact.version}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeHighlight
              code={artifact.content}
              language={artifact.path.split(".").pop() || "ts"}
              maxHeight="300px"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RunsTab({ runs }: { runs: any[] }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-medium mb-2">No runs yet</h2>
        <p className="text-gray-500">
          Click "Regenerate App" to start a new run.
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
