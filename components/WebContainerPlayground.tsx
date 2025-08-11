"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WebContainer } from "@webcontainer/api";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { AlertCircle, CheckCircle2, Terminal } from "lucide-react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  getWebContainerInstance,
  isBrowserCompatible,
} from "../lib/webcontainer-service";

// Types for the component
interface WebContainerPlaygroundProps {
  project: any;
  artifacts: any[];
}

export function WebContainerPlayground({
  project,
  artifacts,
}: WebContainerPlaygroundProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<
    "booting" | "installing" | "starting" | "ready" | "error"
  >("booting");

  const [wcUrl, setWcUrl] = useState<string | null>(null);
  const webcontainerRef = useRef<WebContainer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Track metrics
  const trackMetrics = useMutation(api.metrics.trackWebContainerMetrics);

  // Setup message listener for WebContainer connect route
  useEffect(() => {
    // Check localStorage every second as a fallback communication method
    const checkLocalStorage = () => {
      try {
        const storedData = localStorage.getItem("webcontainer_connect");
        if (storedData) {
          const data = JSON.parse(storedData);
          const connectId = data.connectId;
          const timestamp = data.timestamp;

          // Only process recent messages (within last 10 seconds)
          if (timestamp && Date.now() - timestamp < 10000) {
            setLogs((prev) => [
              ...prev,
              `Found WebContainer connect data in localStorage for ID: ${connectId}`,
            ]);

            // Clear the data so we don't process it again
            localStorage.removeItem("webcontainer_connect");

            // Handle the connection
            handleWebContainerConnect(connectId);
          }
        }
      } catch (err) {
        console.error("Error checking localStorage:", err);
      }
    };

    // Function to handle WebContainer connection
    const handleWebContainerConnect = (connectId: string) => {
      setLogs((prev) => [
        ...prev,
        `Handling WebContainer connect for ID: ${connectId}`,
      ]);

      // If we have a WebContainer URL, update the iframe
      if (wcUrl && iframeRef.current) {
        setLogs((prev) => [...prev, `Connecting to WebContainer at: ${wcUrl}`]);
        iframeRef.current.src = wcUrl;
      } else {
        setLogs((prev) => [...prev, `No WebContainer URL available yet`]);
      }
    };

    // Handle postMessage events
    const handleMessage = (event: MessageEvent) => {
      // Check if this is a message from our connect route
      if (event.data && event.data.type === "WEBCONTAINER_CONNECT") {
        const connectId = event.data.connectId;
        setLogs((prev) => [
          ...prev,
          `Received WebContainer connect message for ID: ${connectId}`,
        ]);

        handleWebContainerConnect(connectId);
      }
    };

    // Add the message listener
    window.addEventListener("message", handleMessage);

    // Set up interval to check localStorage
    const interval = setInterval(checkLocalStorage, 1000);

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, [wcUrl]);

  // Store WebContainer connection info in localStorage for the redirect page to use
  useEffect(() => {
    if (wcUrl) {
      try {
        localStorage.setItem("webcontainer_url", wcUrl);
        localStorage.setItem("current_project_id", project._id);
        setLogs((prev) => [
          ...prev,
          `Stored WebContainer URL and project ID in localStorage`,
        ]);
      } catch (err) {
        console.error("Error storing WebContainer info in localStorage:", err);
      }
    }
  }, [wcUrl, project._id]);

  // Convert artifacts array to WebContainer file system format
  const getFiles = useCallback(() => {
    const files: Record<string, any> = {};

    // Check if there's a package.json in the artifacts
    const hasPackageJson = artifacts.some(
      (artifact) => artifact.path === "package.json"
    );

    // If no package.json exists, add a minimal one
    if (!hasPackageJson) {
      files["package.json"] = {
        file: {
          contents: JSON.stringify(
            {
              name: project?.name?.toLowerCase().replace(/\s+/g, "-") || "app",
              version: "1.0.0",
              description: "Generated app",
              scripts: {
                start: "node index.js",
                dev: "node index.js",
              },
            },
            null,
            2
          ),
        },
      };

      //       // Add a simple index.js if none exists
      //       const hasIndexJs = artifacts.some(
      //         (artifact) =>
      //           artifact.path === "index.js" ||
      //           artifact.path === "server.js" ||
      //           artifact.path === "app.js"
      //       );

      //       if (!hasIndexJs) {
      //         files["index.js"] = {
      //           file: {
      //             contents: `console.log("App is running!");
      // const http = require('http');
      // const fs = require('fs');
      // const path = require('path');

      // // Create a special entry point for the WebContainer redirect
      // fs.writeFileSync('index.html', \`
      //   <html>
      //     <head>
      //       <title>${project?.name || "App"}</title>
      //       <style>
      //         body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
      //         h1 { font-size: 2rem; margin-bottom: 1rem; }
      //         .container { max-width: 800px; margin: 0 auto; }
      //       </style>
      //     </head>
      //     <body>
      //       <div class="container">
      //         <h1>${project?.name || "App"} is running!</h1>
      //         <p>Your application is running in a WebContainer.</p>
      //         <p>This page is being served directly from the WebContainer.</p>
      //       </div>
      //     </body>
      //   </html>
      // \`);

      // // Create a special entry point for the WebContainer redirect path
      // fs.mkdirSync('webcontainer/connect', { recursive: true });
      // fs.writeFileSync('webcontainer/connect/index.html', \`
      //   <html>
      //     <head>
      //       <title>${project?.name || "App"}</title>
      //       <meta http-equiv="refresh" content="0;url=/" />
      //       <style>
      //         body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
      //       </style>
      //     </head>
      //     <body>
      //       <p>Redirecting to app...</p>
      //       <script>
      //         window.location.href = "/";
      //       </script>
      //     </body>
      //   </html>
      // \`);

      // const server = http.createServer((req, res) => {
      //   console.log('Request URL:', req.url);

      //   // Normalize URL
      //   let url = req.url;

      //   // Handle WebContainer specific paths (redirect to root)
      //   if (url.startsWith('/webcontainer/connect/')) {
      //     url = '/';
      //   }

      //   // Handle root path
      //   if (url === '/' || url === '/index.html') {
      //     fs.readFile('index.html', (err, content) => {
      //       if (err) {
      //         res.writeHead(500);
      //         res.end('Error loading index.html');
      //         return;
      //       }
      //       res.writeHead(200, { 'Content-Type': 'text/html' });
      //       res.end(content);
      //     });
      //     return;
      //   }

      //   // Handle other paths
      //   const filePath = url.substring(1); // Remove leading slash
      //   fs.readFile(filePath, (err, content) => {
      //     if (err) {
      //       res.writeHead(404);
      //       res.end('File not found');
      //       return;
      //     }

      //     let contentType = 'text/plain';
      //     if (filePath.endsWith('.html')) contentType = 'text/html';
      //     if (filePath.endsWith('.js')) contentType = 'text/javascript';
      //     if (filePath.endsWith('.css')) contentType = 'text/css';
      //     if (filePath.endsWith('.json')) contentType = 'application/json';

      //     res.writeHead(200, { 'Content-Type': contentType });
      //     res.end(content);
      //   });
      // });

      // server.listen(3000, () => console.log('Server running on port 3000'));`,
      //           },
      //         };
      //       }
    }

    for (const artifact of artifacts) {
      const pathParts = artifact.path.split("/");
      let current = files; // Handle nested directories
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!part) continue;

        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      // Add the file
      const fileName = pathParts[pathParts.length - 1];
      if (fileName) {
        current[fileName] = { file: { contents: artifact.content } };
      }
    }

    return files;
  }, [artifacts]);

  // Setup the WebContainer
  useEffect(() => {
    if (!isBrowserCompatible()) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let isBooting = false;
    const bootStartTime = Date.now();

    const setupWebContainer = async () => {
      try {
        if (isBooting) return;

        isBooting = true;
        // Set the initial status
        setStatus("booting");
        setLogs((prev) => [...prev, "Booting WebContainer..."]);

        // Get the singleton WebContainer instance
        const webcontainer = await getWebContainerInstance();
        if (!webcontainer) {
          throw new Error("Failed to get WebContainer instance");
        }

        // Store reference to the WebContainer
        webcontainerRef.current = webcontainer;

        const bootDuration = Date.now() - bootStartTime;
        setLogs((prev) => [
          ...prev,
          `WebContainer booted successfully in ${bootDuration}ms`,
        ]);

        // Track boot time metrics
        trackMetrics({
          projectId: project._id,
          wc_boot_ms: bootDuration,
        });

        // Convert artifacts to files and mount them
        const files = getFiles();
        await webcontainerRef.current.mount(files);
        setLogs((prev) => [...prev, "Files mounted to virtual file system"]);

        // Install dependencies
        setStatus("installing");
        setLogs((prev) => [...prev, "Installing dependencies..."]);

        // Check if package.json has dependencies
        const packageJsonContent = await webcontainerRef.current.fs.readFile(
          "package.json",
          "utf-8"
        );
        const packageJsonData = JSON.parse(packageJsonContent);

        if (
          packageJsonData.dependencies &&
          Object.keys(packageJsonData.dependencies).length > 0
        ) {
          const installProcess = await webcontainerRef.current.spawn("npm", [
            "install",
          ]);

          installProcess.output.pipeTo(
            new WritableStream({
              write(data) {
                if (isMounted) {
                  setLogs((prev) => [...prev, data]);
                }
              },
            })
          );

          // Wait for install to complete
          const installExitCode = await installProcess.exit;

          if (installExitCode !== 0) {
            setLogs((prev) => [
              ...prev,
              "Warning: Dependency installation had issues, but continuing...",
            ]);
          } else {
            setLogs((prev) => [...prev, "Dependencies installed successfully"]);
          }
        } else {
          setLogs((prev) => [
            ...prev,
            "No dependencies to install, skipping...",
          ]);
        }

        // Start the application
        setStatus("starting");
        setLogs((prev) => [...prev, "Starting application..."]);

        // Check if we need to create a basic server file
        try {
          const files = await webcontainerRef.current.fs.readdir(".");
          const hasServerFile = files.some((file) =>
            ["index.js", "server.js", "app.js", "main.js"].includes(file)
          );

          if (!hasServerFile) {
            // Create a basic server file that can handle WebContainer routes
            await webcontainerRef.current.fs.writeFile(
              "index.js",
              `const http = require('http');
const fs = require('fs');
const path = require('path');

// Simple file server
const serveFile = (filePath, res) => {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + err.code);
      }
      return;
    }
    
    // Determine content type
    const extname = path.extname(filePath);
    let contentType = 'text/plain';
    
    switch (extname) {
      case '.html':
        contentType = 'text/html';
        break;
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
        contentType = 'image/jpg';
        break;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
};

// Create server
const server = http.createServer((req, res) => {
  console.log('Request URL:', req.url);
  
  // Handle root path
  if (req.url === '/' || req.url === '/index.html') {
    return serveFile('index.html', res);
  }
  
  // Handle WebContainer specific paths for redirects
  if (req.url.startsWith('/webcontainer/connect/')) {
    const connectPath = req.url.substring(1); // Remove leading slash
    const connectDir = path.dirname(connectPath);
    
    // Try to serve the index.html from the connect directory
    const indexFile = path.join(connectDir, 'index.html');
    
    try {
      if (fs.existsSync(indexFile)) {
        return serveFile(indexFile, res);
      }
    } catch (err) {
      console.error('Error checking for index file:', err);
    }
    
    // If no index file exists, serve a default response
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(\`
      <!DOCTYPE html>
      <html>
      <head>
        <title>App Preview</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
          h1 { font-size: 2rem; margin-bottom: 1rem; }
        </style>
      </head>
      <body>
        <h1>App is running!</h1>
        <p>WebContainer is working.</p>
      </body>
      </html>
    \`);
    return;
  }
  
  // Attempt to serve the file from the filesystem
  const filePath = req.url.substring(1); // Remove leading slash
  if (fs.existsSync(filePath)) {
    return serveFile(filePath, res);
  }
  
  // Default 404 response
  res.writeHead(404, { 'Content-Type': 'text/html' });
  res.end('<h1>404 Not Found</h1>');
});

// Create a default index.html if it doesn't exist
if (!fs.existsSync('index.html')) {
  fs.writeFileSync('index.html', \`
    <!DOCTYPE html>
    <html>
    <head>
      <title>App Preview</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
      </style>
    </head>
    <body>
      <h1>App is running!</h1>
      <p>This is a preview of your application running in a WebContainer.</p>
    </body>
    </html>
  \`);
}

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});`
            );
            setLogs((prev) => [...prev, "Created a basic server file"]);
          }
        } catch (err: any) {
          setLogs((prev) => [...prev, `Warning: ${err.message}`]);
        }

        // Determine what command to run based on package.json
        const packageJsonStartContent =
          await webcontainerRef.current.fs.readFile("package.json", "utf-8");
        const packageJson = JSON.parse(packageJsonStartContent);
        let startCommand = "node";
        let startArgs: string[] = [];

        // Always create the connect path handler regardless of app
        try {
          // Extract the connection ID from WebContainer URL that will be generated
          setLogs((prev) => [...prev, "Creating special redirect handler..."]);

          // Create the directory structure
          await webcontainerRef.current.fs.mkdir("webcontainer", {
            recursive: true,
          });
          await webcontainerRef.current.fs.mkdir("webcontainer/connect", {
            recursive: true,
          });

          // Create a redirect handler that will work with all types of apps
          await webcontainerRef.current.fs.writeFile(
            "webcontainer/connect/index.html",
            `<!DOCTYPE html>
<html>
<head>
  <title>${project?.name || "App"} Redirect</title>
  <meta http-equiv="refresh" content="0;url=/" />
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5; }
  </style>
</head>
<body>
  <p>Redirecting to app...</p>
  <script>
    window.location.href = "/";
  </script>
</body>
</html>`
          );

          setLogs((prev) => [
            ...prev,
            "Created redirect handler for WebContainer",
          ]);
        } catch (err: any) {
          setLogs((prev) => [
            ...prev,
            `Warning: Could not create redirect handler: ${err.message}`,
          ]);
        }

        // First try to use npm start if it exists
        if (packageJson.scripts && packageJson.scripts.dev) {
          startCommand = "npm";
          startArgs = ["run", "dev"];
          setLogs((prev) => [
            ...prev,
            "Found 'dev' script in package.json, using 'npm run dev'",
          ]);
        } else if (packageJson.scripts && packageJson.scripts.start) {
          startCommand = "npm";
          startArgs = ["run", "start"];
          setLogs((prev) => [
            ...prev,
            "Found 'start' script in package.json, using 'npm run start'",
          ]);
        } else {
          // If no scripts, try to find an entry point file
          const files = await webcontainerRef.current.fs.readdir(".");
          const entryPoints = ["index.js", "server.js", "app.js", "main.js"];

          for (const entryPoint of entryPoints) {
            if (files.includes(entryPoint)) {
              startArgs = [entryPoint];
              setLogs((prev) => [
                ...prev,
                `Found ${entryPoint}, using 'node ${entryPoint}'`,
              ]);
              break;
            }
          }

          if (startArgs.length === 0) {
            setLogs((prev) => [
              ...prev,
              "No entry point found, using index.js",
            ]);
            startArgs = ["index.js"];
          }
        }

        // Start the app
        const devProcess = await webcontainerRef.current.spawn(
          startCommand,
          startArgs
        );

        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              if (isMounted) {
                setLogs((prev) => [...prev, data]);
              }
            },
          })
        );

        // Listen for the server to start
        webcontainerRef.current.on("server-ready", (port, url) => {
          if (isMounted) {
            const readyTime = Date.now() - bootStartTime;
            setLogs((prev) => [
              ...prev,
              `Server ready on port ${port}: ${url} in ${readyTime}ms`,
            ]);

            // Store the WebContainer URL for later use
            setWcUrl(url);

            // Extract the connection ID from the URL for debugging
            try {
              const urlObj = new URL(url);
              const hostname = urlObj.hostname;
              const connectId = hostname.split("--")[2]?.split(".")[0];

              if (connectId) {
                setLogs((prev) => [
                  ...prev,
                  `WebContainer connect ID: ${connectId}`,
                ]);
              }
            } catch (err) {
              console.error("Error parsing WebContainer URL:", err);
            }

            // Set iframe src directly to the WebContainer URL
            if (iframeRef.current) {
              iframeRef.current.src = url;
            }

            setStatus("ready");
            setIsLoading(false);

            // Track server ready time metrics
            trackMetrics({
              projectId: project._id,
              wc_boot_ms: Date.now() - bootStartTime,
              wc_ready_ms: readyTime,
            });
          }
        });
      } catch (err: any) {
        if (isMounted) {
          console.error("WebContainer error:", err);
          setError(err.message || "Failed to setup WebContainer");
          setStatus("error");
          setIsLoading(false);

          // Track error metrics
          trackMetrics({
            projectId: project._id,
            wc_boot_ms: Date.now() - bootStartTime,
            wc_error: err.message || "Unknown error",
          });
        }
      }
    };

    setupWebContainer();

    return () => {
      isMounted = false;
      // Cleanup WebContainer when component unmounts
      if (webcontainerRef.current) {
        webcontainerRef.current.teardown();
        webcontainerRef.current = null;
        // Note: WebContainer API doesn't have a clear cleanup method as of now
        // But we can ensure we don't update state after unmount
      }
    };
  }, [getFiles, project._id, trackMetrics]);

  // Render browser compatibility notice if not supported
  if (!isSupported) {
    return (
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {project?.name || "App"} Preview
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link href={`/projects/${project._id}`}>Back to Project</Link>
          </Button>
        </div>

        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Browser Not Supported</AlertTitle>
          <AlertDescription>
            WebContainers require a Chromium-based browser (Chrome, Edge, Arc)
            with cross-origin isolation enabled. Please switch to a supported
            browser to preview your app.
          </AlertDescription>
        </Alert>

        <div className="flex-1 bg-gray-50 rounded-lg p-6 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Supported Browsers</h2>
            <ul className="list-disc list-inside mb-4 text-left inline-block">
              <li>Google Chrome (latest version)</li>
              <li>Microsoft Edge (latest version)</li>
              <li>Arc Browser (latest version)</li>
            </ul>
            <p className="text-sm text-gray-500">
              Firefox and Safari currently do not support the technology
              required by WebContainers.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {project?.name || "App"} Preview
          </h1>
          <p className="text-sm text-gray-500">
            Running in WebContainer - Node.js in your browser
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${project._id}`}>Back to Project</Link>
        </Button>
      </div>

      {status === "error" && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {status === "ready" && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Ready</AlertTitle>
          <AlertDescription>
            Your application is now running in a Node.js environment directly in
            your browser!
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg overflow-hidden border border-gray-200 bg-white">
          {isLoading ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="space-y-4 w-full">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              className="w-full h-full min-h-[500px]"
              title="App Preview"
            />
          )}
        </div>

        <div className="bg-black text-green-400 rounded-lg p-4 font-mono text-sm overflow-auto h-[500px]">
          <div className="flex items-center space-x-2 mb-2 sticky top-0 bg-black pb-2">
            <Terminal size={16} />
            <h3 className="font-semibold">Console Output</h3>
          </div>
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="break-words">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
