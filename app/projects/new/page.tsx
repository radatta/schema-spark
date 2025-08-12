"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StickyHeader } from "@/components/layout/sticky-header";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useAction,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent } from "react";
import { useRunStatus } from "@/hooks/use-run-status";
import { useToast } from "@/components/ui/use-toast";
import { useStreamingGeneration } from "@/hooks/use-streaming-generation";

export default function NewProject() {
  return (
    <>
      <StickyHeader className="px-4 py-2">
        <div className="flex justify-between items-center">
          <Link href="/" className="font-bold text-xl">
            Schema Spark
          </Link>
          <SignInAndSignUpButtons />
        </div>
      </StickyHeader>
      <main className="container mx-auto px-4 py-8">
        <Authenticated>
          <NewProjectForm />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">Please sign in to create a new project.</p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInAndSignUpButtons() {
  return (
    <div className="flex gap-4">
      <Authenticated>
        <UserButton afterSignOutUrl="#" />
      </Authenticated>
      <Unauthenticated>
        <SignInButton mode="modal">
          <Button variant="ghost">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button>Sign up</Button>
        </SignUpButton>
      </Unauthenticated>
    </div>
  );
}

function NewProjectForm() {
  const createProject = useMutation(api.projects.create);
  const createRun = useMutation(api.runs.create);
  const router = useRouter();

  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [currentRunId, setCurrentRunId] = useState<Id<"runs"> | null>(null);
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);

  // Initialize streaming hook
  const streaming = useStreamingGeneration(currentRunId);

  // Use the run status hook to show toast notifications
  useRunStatus(currentRunId || undefined);

  // Debug currentRunId changes
  useEffect(() => {
    console.log(`NewProjectForm: currentRunId changed to: ${currentRunId}`);
  }, [currentRunId]);

  // Auto-navigate when streaming is complete
  useEffect(() => {
    if (streaming.isComplete && projectId) {
      console.log("Streaming completed, navigating to project page");
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 2000); // Give time for completion toast
    }
  }, [streaming.isComplete, projectId, router]);

  // Start streaming when run ID becomes available
  useEffect(() => {
    if (currentRunId && projectId && spec.trim() && !streaming.isStreaming) {
      console.log("Starting streaming generation with run ID:", currentRunId);
      streaming.startGeneration(
        projectId,
        spec.trim(),
        "gpt-4-turbo"
      ).catch((err) => {
        console.error("Streaming generation failed:", err);
        setError(err instanceof Error ? err.message : "Generation failed");
        setIsSubmitting(false);
      });
    }
  }, [currentRunId, projectId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !spec.trim()) {
      setError("Project name and specification are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Create the project
      const newProjectId = await createProject({ name: name.trim() });
      console.log("Project created with ID:", newProjectId);
      setProjectId(newProjectId);

      // Create a run first so we can start monitoring it immediately
      const runId = await createRun({
        projectId: newProjectId,
        model: "gpt-4-turbo",
        promptVersion: "v1",
      });

      console.log("Run created with ID:", runId);

      // Start monitoring the run status immediately
      setCurrentRunId(runId);
      console.log("Started monitoring run:", runId);

      // Streaming will start automatically via useEffect when currentRunId is set

    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      console.error("Error during project creation:", errorMessage);
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const exampleSpec =
    "Todo app with title and done fields. Add, toggle completion, filter by completion status. Store per user.";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create a New Project</h1>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>
            Describe your application in natural language, and our agent will
            generate a functional app for you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-1"
                >
                  Project Name
                </label>
                <Input
                  id="name"
                  placeholder="My App"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting || streaming.isStreaming}
                />
              </div>

              <div>
                <label
                  htmlFor="spec"
                  className="block text-sm font-medium mb-1"
                >
                  App Specification
                </label>
                <Textarea
                  id="spec"
                  placeholder={exampleSpec}
                  value={spec}
                  onChange={(e) => setSpec(e.target.value)}
                  disabled={isSubmitting || streaming.isStreaming}
                  className="min-h-[150px]"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Example: {exampleSpec}
                </p>
              </div>

              {(error || streaming.error) && (
                <div className="text-red-500 text-sm">{error || streaming.error}</div>
              )}

              {/* Streaming status display */}
              {streaming.isStreaming && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{streaming.currentPhase}</span>
                      {streaming.currentMessage && (
                        <span className="ml-2 text-sm">{streaming.currentMessage}</span>
                      )}
                    </div>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
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
                  {Object.keys(streaming.files).length > 0 && (
                    <div className="mt-2 text-sm">
                      <div className="text-xs text-blue-600">
                        Generated files: {Object.keys(streaming.files).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || streaming.isStreaming}
              >
                {streaming.isStreaming 
                  ? `Generating (${streaming.currentPhase})...` 
                  : isSubmitting 
                    ? "Creating Project..." 
                    : "Generate App"}
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button variant="outline" asChild>
            <Link href="/">Cancel</Link>
          </Button>
          <div className="text-sm text-gray-500">Powered by LLM Agent</div>
        </CardFooter>
      </Card>
    </div>
  );
}
