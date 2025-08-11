"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WebContainerConnectRoute({
  params,
}: {
  params: { id: string };
}) {
  const [message, setMessage] = useState("Connecting to WebContainer...");
  const [debug, setDebug] = useState<string[]>([]);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // This function handles the WebContainer redirect
    // by forwarding the request back to the WebContainer iframe
    const connectId = params.id;

    setDebug((prev) => [...prev, `Connect ID: ${connectId}`]);

    // Try to get the WebContainer URL and project ID from localStorage
    try {
      const storedUrl = localStorage.getItem("webcontainer_url");
      if (storedUrl) {
        setDirectUrl(storedUrl);
        setDebug((prev) => [
          ...prev,
          `Found WebContainer URL in localStorage: ${storedUrl}`,
        ]);
      } else {
        setDebug((prev) => [
          ...prev,
          `No WebContainer URL found in localStorage`,
        ]);
      }

      const storedProjectId = localStorage.getItem("current_project_id");
      if (storedProjectId) {
        setProjectId(storedProjectId);
        setDebug((prev) => [
          ...prev,
          `Found project ID in localStorage: ${storedProjectId}`,
        ]);
      }
    } catch (err: any) {
      setDebug((prev) => [
        ...prev,
        `Error reading localStorage: ${err.message || String(err)}`,
      ]);
    }

    try {
      // Try to send a message to all potential parent windows
      window.parent.postMessage(
        {
          type: "WEBCONTAINER_CONNECT",
          connectId,
          timestamp: Date.now(),
        },
        "*"
      );

      setDebug((prev) => [...prev, "Message posted to parent window"]);

      // Also try to send to the top window
      if (window.top && window.top !== window.parent) {
        window.top.postMessage(
          {
            type: "WEBCONTAINER_CONNECT",
            connectId,
            timestamp: Date.now(),
          },
          "*"
        );
        setDebug((prev) => [...prev, "Message posted to top window"]);
      }

      // Try to send via localStorage as a fallback communication method
      try {
        localStorage.setItem(
          "webcontainer_connect",
          JSON.stringify({
            connectId,
            timestamp: Date.now(),
          })
        );
        setDebug((prev) => [...prev, "Data stored in localStorage"]);
      } catch (err: any) {
        setDebug((prev) => [
          ...prev,
          `localStorage error: ${err.message || String(err)}`,
        ]);
      }
    } catch (err: any) {
      setDebug((prev) => [
        ...prev,
        `Error posting message: ${err.message || String(err)}`,
      ]);
    }

    // Set a timer to show a message if things are taking too long
    const timeout = setTimeout(() => {
      setMessage(
        "WebContainer connection is taking longer than expected. Please use one of the options below."
      );
    }, 2000);

    return () => clearTimeout(timeout);
  }, [params.id]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">WebContainer Connection</h1>
      <p className="mb-4">{message}</p>
      <div className="mb-4">
        <p>
          Connect ID: <code>{params.id}</code>
        </p>
      </div>

      <div className="space-y-4 mb-6">
        {projectId && (
          <div>
            <Link
              href={`/preview?projectId=${projectId}`}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 inline-block"
            >
              Return to Project Preview
            </Link>
          </div>
        )}

        {directUrl && (
          <div>
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 inline-block"
            >
              Open WebContainer Directly
            </a>
            <p className="text-sm mt-2">
              (This will open the WebContainer URL directly)
            </p>
          </div>
        )}

        <div>
          <a
            href="/"
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 inline-block"
          >
            Go to Homepage
          </a>
        </div>
      </div>

      <div className="text-left w-full max-w-md bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-bold mb-2">Debug Information</h2>
        <pre className="text-xs overflow-auto max-h-40">
          {debug.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}
