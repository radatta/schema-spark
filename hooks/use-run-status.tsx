"use client";

import { useToast } from "@/components/ui/use-toast";
import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Define the possible status types
type RunStatus =
  | "planning"
  | "generating"
  | "validating"
  | "completed"
  | "failed";

export function useRunStatus(runId?: Id<"runs">) {
  const { toast, dismiss } = useToast();
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const toastIdRef = useRef<string | null>(null);
  const hasShownIntermediateStatusRef = useRef({
    planning: false,
    generating: false,
    validating: false,
    completed: false,
    failed: false,
  });

  // Get the run data
  const run = useQuery(api.runs.get, runId ? { id: runId } : "skip");

  // Function to show a status toast (using useCallback to avoid dependency issues)
  const showStatusToast = useCallback(
    (status: RunStatus) => {
      // Mark this status as shown using ref
      hasShownIntermediateStatusRef.current = {
        ...hasShownIntermediateStatusRef.current,
        [status]: true,
      };

      // Define status messages inside the callback to get latest run data
      const currentStatusMessages = {
        planning: {
          title: "Planning in progress",
          description:
            "Analyzing your specification and planning the application structure...",
        },
        generating: {
          title: "Generating code",
          description:
            "Creating schema, queries, mutations, and UI components...",
        },
        validating: {
          title: "Validating code",
          description: "Testing the generated code for errors and quality...",
        },
        completed: {
          title: "Generation complete",
          description: "Your application has been successfully generated!",
        },
        failed: {
          title: "Generation failed",
          description: run?.error || "An error occurred during generation.",
        },
      };

      const statusInfo = currentStatusMessages[status];

      // Choose toast variant based on status
      const variant =
        status === "failed"
          ? "destructive"
          : status === "completed"
            ? "success"
            : "info";

      // Dismiss the previous toast if it exists
      if (toastIdRef.current) {
        dismiss(toastIdRef.current);
      }

      const { id } = toast({
        title: statusInfo.title,
        description: statusInfo.description,
        variant,
        // Only auto-dismiss completed and failed states
        duration:
          status === "completed" || status === "failed" ? 5000 : Infinity,
      });

      toastIdRef.current = id;

      // Update last status
      setLastStatus(status);
    },
    [toast, dismiss, run?.error]
  );

  // When a new run ID is set, reset everything
  useEffect(() => {
    if (runId) {
      setLastStatus(null);
      hasShownIntermediateStatusRef.current = {
        planning: false,
        generating: false,
        validating: false,
        completed: false,
        failed: false,
      };

      // Show initial planning toast immediately for better user feedback
      showStatusToast("planning");
    }
  }, [runId]); // Remove showStatusToast from dependencies to prevent infinite loop

  // Effect to handle run status changes and simulate missing statuses
  useEffect(() => {
    // If we don't have a run or runId, we can't do anything
    if (!runId) {
      return;
    }

    // If we don't have run data yet but have a runId, we're waiting for data
    if (!run) {
      return;
    }

    const currentStatus = run.status as RunStatus;

    // Status simulation logic to ensure we show all steps
    if (currentStatus === "completed" || currentStatus === "failed") {
      // If we got the final status, make sure we've shown all intermediate statuses
      if (
        !hasShownIntermediateStatusRef.current.generating &&
        !hasShownIntermediateStatusRef.current.validating
      ) {
        // If we've only shown planning and then suddenly got completed/failed,
        // show the generating and validating stages with short timeouts

        if (!hasShownIntermediateStatusRef.current.generating) {
          setTimeout(() => {
            showStatusToast("generating");
          }, 1000);

          setTimeout(() => {
            showStatusToast("validating");
          }, 2000);

          setTimeout(() => {
            showStatusToast(currentStatus);
          }, 3000);

          return;
        }
      }
    } else if (
      currentStatus === "generating" &&
      !hasShownIntermediateStatusRef.current.generating
    ) {
      // Make sure we've shown the generating status
      showStatusToast("generating");
      return;
    } else if (
      currentStatus === "validating" &&
      !hasShownIntermediateStatusRef.current.validating
    ) {
      // Make sure we've shown the validating status
      showStatusToast("validating");
      return;
    }

    // For normal status changes that aren't already handled
    if (
      currentStatus &&
      currentStatus !== lastStatus &&
      !hasShownIntermediateStatusRef.current[currentStatus]
    ) {
      showStatusToast(currentStatus);
    }
  }, [run, runId, lastStatus]); // Remove hasShownIntermediateStatus and showStatusToast from dependencies

  return run;
}
