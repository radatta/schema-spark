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
}

export function StackBlitzEditor({
  artifacts,
  projectName,
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
    if (!mounted || !containerRef.current || !artifacts.length) {
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
            openFile: files["index.html"]
              ? "index.html"
              : Object.keys(files)[0],
            view: "default",
            theme: "light",
            hideExplorer: false,
            hideNavigation: false,
            forceEmbedLayout: true,
            // crossOriginIsolated: true,
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
  }, [mounted, artifacts, projectName]);

  if (!artifacts.length) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No artifacts yet
          </h3>
          <p className="text-gray-500">
            Run the agent to generate app artifacts.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-900 mb-2">
            Failed to load StackBlitz
          </h3>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
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
