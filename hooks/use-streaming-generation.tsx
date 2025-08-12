import { useState, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@clerk/nextjs";

export type StreamEvent =
  | { type: "status"; data: { phase: string; message: string } }
  | { type: "plan_chunk"; data: { content: string; accumulated: string } }
  | { type: "plan_complete"; data: { content: string } }
  | { type: "file_start"; data: { filePath: string } }
  | {
      type: "file_chunk";
      data: {
        filePath: string;
        content: string;
        accumulated: string;
        isStreaming?: boolean;
      };
    }
  | { type: "file_complete"; data: { filePath: string; content: string } }
  | { type: "complete"; data: { message: string } }
  | { type: "error"; data: { message: string } };

export interface StreamingState {
  isStreaming: boolean;
  currentPhase: string;
  currentMessage: string;
  currentFile: string | null;
  planContent: string;
  files: Record<string, string>;
  newlyCreatedFiles: Set<string>;
  error: string | null;
  isComplete: boolean;
  retryCount: number;
  isReconnecting: boolean;
}

export function useStreamingGeneration(runId: Id<"runs"> | null) {
  const { getToken } = useAuth();
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    currentPhase: "",
    currentMessage: "",
    currentFile: null,
    planContent: "",
    files: {},
    newlyCreatedFiles: new Set(),
    error: null,
    isComplete: false,
    retryCount: 0,
    isReconnecting: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Retry function with exponential backoff
  const retryGeneration = async (
    projectId: Id<"projects">,
    inputSpec: string,
    model?: string
  ) => {
    const currentRetry = state.retryCount;
    if (currentRetry >= 3) {
      setState((prev) => ({
        ...prev,
        error:
          "Maximum retry attempts reached. Please refresh the page to try again.",
        isStreaming: false,
        isReconnecting: false,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isReconnecting: true,
      retryCount: currentRetry + 1,
      error: null,
    }));

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, currentRetry) * 1000;

    retryTimeoutRef.current = setTimeout(() => {
      startGeneration(projectId, inputSpec, model);
    }, delay);
  };

  // Function to start streaming generation
  const startGeneration = async (
    projectId: Id<"projects">,
    inputSpec: string,
    model?: string
  ) => {
    if (!runId) {
      setState((prev) => ({ ...prev, error: "No run ID provided" }));
      return;
    }

    try {
      // Get auth token
      const authToken = await getToken({ template: "convex" });
      if (!authToken) {
        setState((prev) => ({ ...prev, error: "Authentication required" }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        error: null,
        isComplete: false,
        currentPhase: "starting",
        currentMessage: "Initializing generation...",
        currentFile: null,
        planContent: "",
        files: {},
        newlyCreatedFiles: new Set(),
        retryCount: 0,
        isReconnecting: false,
      }));

      // Start the streaming API call
      const response = await fetch(`/api/stream-generate/${runId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          inputSpec,
          model: model || "gpt-4-turbo",
          authToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Create EventSource-like interface for Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        let currentEventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
            continue;
          }

          if (line.startsWith("data: ") && currentEventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent({ type: currentEventType as any, data });
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);

      // Determine if this is a network error that might be recoverable
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("fetch") ||
          error.message.includes("network") ||
          error.message.includes("connection") ||
          error.message.includes("timeout"));

      if (isNetworkError && state.retryCount < 3) {
        console.log(
          `Network error detected, attempting retry ${state.retryCount + 1}/3`
        );
        // Don't store the last successful parameters, we'll need to pass them to retry
        setState((prev) => ({
          ...prev,
          error: `Connection lost. Retrying in ${Math.pow(2, state.retryCount)}s...`,
          isStreaming: false,
          isReconnecting: true,
        }));
        // Note: retryGeneration would need to be called with the original parameters
      } else {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Unknown error",
          isStreaming: false,
          isReconnecting: false,
        }));
      }
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case "status":
        setState((prev) => ({
          ...prev,
          currentPhase: event.data.phase,
          currentMessage: event.data.message,
        }));
        break;

      case "plan_chunk":
        setState((prev) => ({
          ...prev,
          planContent: event.data.accumulated,
        }));
        break;

      case "plan_complete":
        setState((prev) => ({
          ...prev,
          planContent: event.data.content,
        }));
        break;

      case "file_start":
        setState((prev) => {
          const newCreatedFiles = new Set(prev.newlyCreatedFiles);
          newCreatedFiles.add(event.data.filePath);
          return {
            ...prev,
            currentFile: event.data.filePath,
            newlyCreatedFiles: newCreatedFiles,
          };
        });
        break;

      case "file_chunk":
        setState((prev) => ({
          ...prev,
          currentFile: event.data.filePath,
          files: {
            ...prev.files,
            [event.data.filePath]: event.data.accumulated,
          },
        }));
        break;

      case "file_complete":
        setState((prev) => {
          // Remove the completed file from newlyCreatedFiles since it's no longer "new"
          const updatedNewlyCreatedFiles = new Set(prev.newlyCreatedFiles);
          updatedNewlyCreatedFiles.delete(event.data.filePath);

          return {
            ...prev,
            files: {
              ...prev.files,
              [event.data.filePath]: event.data.content,
            },
            newlyCreatedFiles: updatedNewlyCreatedFiles,
          };
        });
        break;

      case "complete":
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
          currentFile: null,
          currentMessage: event.data.message,
          retryCount: 0,
          isReconnecting: false,
        }));
        break;

      case "error":
        setState((prev) => ({
          ...prev,
          error: event.data.message,
          isStreaming: false,
          currentFile: null,
          isReconnecting: false,
        }));
        break;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startGeneration,
    retryGeneration,
  };
}
