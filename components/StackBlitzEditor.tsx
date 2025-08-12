"use client";

import { useEffect, useRef, useState } from "react";
import sdk from "@stackblitz/sdk";
import type { VM } from "@stackblitz/sdk";

interface StackBlitzEditorProps {
  artifacts: Array<{
    _id: string;
    path: string;
    content: string;
    version: number;
  }>;
  projectName: string;
  // New props for streaming
  streamingFiles?: Record<string, string>;
  isGenerating?: boolean;
  currentFile?: string;
  newlyCreatedFiles?: Set<string>; // Track which files are newly created
}

export function StackBlitzEditor({
  artifacts,
  projectName,
  streamingFiles = {},
  isGenerating = false,
  currentFile,
  newlyCreatedFiles = new Set(),
}: StackBlitzEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vmRef = useRef<VM | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before initializing StackBlitz
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) {
      setIsLoading(false);
      return;
    }

    // Initialize StackBlitz if:
    // 1. We have artifacts, OR
    // 2. We're currently generating (for streaming)
    const shouldInitialize = artifacts.length > 0 || isGenerating;

    if (!shouldInitialize) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function initializeStackBlitz() {
      try {
        setIsLoading(true);
        setError(null);

        if (isCancelled || !containerRef.current) return;

        // Create a fresh container div for StackBlitz
        const stackblitzContainer = document.createElement("div");
        stackblitzContainer.style.width = "100%";
        stackblitzContainer.style.height = "80%";

        // Clear and append the container
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(stackblitzContainer);

        // Convert artifacts to StackBlitz files format
        const files: Record<string, string> = {};
        artifacts.forEach((artifact) => {
          files[artifact.path] = artifact.content;
        });

        // If we're generating but have no artifacts yet, start with a basic file
        if (isGenerating && Object.keys(files).length === 0) {
          files["README.md"] =
            "# Generating your application...\n\nPlease wait while we create your files.";
        }

        // Determine the template based on the files
        let template:
          | "angular-cli"
          | "create-react-app"
          | "html"
          | "javascript"
          | "node"
          | "polymer"
          | "typescript"
          | "vue" = "html";

        if (files["package.json"]) {
          try {
            const packageJson = JSON.parse(files["package.json"]);
            if (packageJson.dependencies?.next) {
              template = "node"; // Next.js projects work better with node template
            } else if (packageJson.dependencies?.react) {
              template = "create-react-app";
            } else {
              template = "node";
            }
          } catch (e) {
            console.warn("Failed to parse package.json, using html template");
            template = "html";
          }
        }

        if (isCancelled) return;

        console.log("Initializing StackBlitz with files:", files);

        // Create the StackBlitz project
        const vm = await sdk.embedProject(
          stackblitzContainer,
          {
            title: projectName,
            description: `Generated application: ${projectName}`,
            template,
            files,
          },
          {
            height: 600,
            openFile: files["README.md"] ? "README.md" : Object.keys(files)[0],
            view: "default",
            theme: "dark",
          }
        );

        if (!isCancelled) {
          vmRef.current = vm;
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Failed to initialize StackBlitz:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load StackBlitz"
          );
          setIsLoading(false);
        }
      }
    }

    initializeStackBlitz();

    // Cleanup function
    return () => {
      isCancelled = true;
      if (vmRef.current) {
        vmRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [mounted, artifacts, projectName, isGenerating]);

  // Handle streaming file updates
  // Add debouncing for file updates to prevent partial file analysis
  const [debouncedStreamingFiles, setDebouncedStreamingFiles] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!isGenerating || Object.keys(streamingFiles).length === 0) {
      setDebouncedStreamingFiles({});
      return;
    }

    // Debounce file updates to prevent StackBlitz from analyzing incomplete files
    const timeoutId = setTimeout(() => {
      setDebouncedStreamingFiles(streamingFiles);
    }, 50); // 150ms debounce

    return () => clearTimeout(timeoutId);
  }, [streamingFiles, isGenerating]);

  useEffect(() => {
    if (
      !vmRef.current ||
      !isGenerating ||
      Object.keys(debouncedStreamingFiles).length === 0
    ) {
      return;
    }
    // Apply file updates using applyFsDiff
    const filesToUpdate: Record<string, string> = {};

    for (const [filePath, content] of Object.entries(debouncedStreamingFiles)) {
      // For streaming, include all files even if they have minimal content
      filesToUpdate[filePath] = content || "";
    }

    if (Object.keys(filesToUpdate).length > 0) {
      vmRef.current
        .applyFsDiff({
          create: filesToUpdate,
          destroy: [], // Required property for FsDiff
        })
        .then(async () => {
          // Only focus on the current file if it's newly created, not on every update
          if (
            currentFile &&
            vmRef.current?.editor &&
            filesToUpdate[currentFile] &&
            newlyCreatedFiles.has(currentFile)
          ) {
            try {
              console.log("Opening newly created file:", currentFile);
              // Small delay to ensure StackBlitz has processed the file creation
              await new Promise((resolve) => setTimeout(resolve, 100));

              // Try to open the newly created file
              await vmRef.current.editor.openFile(currentFile);

              // Also set it as the current file if the method exists
              if (vmRef.current.editor.setCurrentFile) {
                await vmRef.current.editor.setCurrentFile(currentFile);
              }
            } catch (error) {
              // Handle specific StackBlitz file not found errors silently
              if (
                error instanceof Error &&
                error.message.includes("Could not find source file")
              ) {
                // This is expected during rapid streaming - file might not be ready yet
                console.debug(`File ${currentFile} not ready for focusing yet`);
              } else {
                // Log other unexpected errors
                console.warn(
                  `Unexpected error focusing on ${currentFile}:`,
                  error
                );
              }
            }
          }
        })
        .catch((error) => {
          console.error("Failed to update streaming files:", error);
        });
    }
  }, [debouncedStreamingFiles, isGenerating, currentFile, newlyCreatedFiles]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-medium text-red-900 mb-2">
            Failed to load StackBlitz IDE
          </h3>
          <p className="text-red-700 mb-4 text-sm">{error}</p>
          <div className="space-x-2">
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                // Trigger re-initialization
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            If this persists, try refreshing the page or check your network
            connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading StackBlitz IDE...</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="w-full h-[600px] border rounded-lg overflow-hidden bg-white"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
}
