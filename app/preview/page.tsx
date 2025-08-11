"use client";

import { Button } from "../../components/ui/button";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Skeleton } from "../../components/ui/skeleton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { SignInButton } from "@clerk/nextjs";
import { Header } from "../../components/layout/header";
import { WebContainerPlayground } from "../../components/WebContainerPlayground";

export default function Preview() {
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const router = useRouter();

  // Redirect if no project ID
  useEffect(() => {
    if (!projectIdParam) {
      router.push("/projects");
    }
  }, [projectIdParam, router]);

  if (!projectIdParam) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="flex flex-col h-[calc(100vh-56px)]">
        <Authenticated>
          <AppPreview projectId={projectIdParam as unknown as Id<"projects">} />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">Please sign in to preview your app.</p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function AppPreview({ projectId }: { projectId: Id<"projects"> }) {
  const project = useQuery(api.projects.get, { id: projectId });
  const artifacts = useQuery(api.artifacts.byProject, { projectId });

  if (project === undefined || artifacts === undefined) {
    return (
      <div className="flex-1 p-6 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="flex-1 bg-gray-50 rounded-lg p-6">
          <Skeleton className="h-8 w-full mb-4" />
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-8 w-40 mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <WebContainerPlayground project={project} artifacts={artifacts} />
    </div>
  );
}
