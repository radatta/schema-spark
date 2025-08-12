"use client";

import { Button } from "@/components/ui/button";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SignUpButton } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <Authenticated>
          <Dashboard />
        </Authenticated>
        <Unauthenticated>
          <LandingPage />
        </Unauthenticated>
      </main>
    </>
  );
}

function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <h1 className="text-4xl font-extrabold mb-2 text-center">Schema Spark</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-2xl">
        Spec-to-App Mini Agent with Convex, Next.js, and LLM Ops
      </p>

      <div className="max-w-md text-center">
        <p className="mb-6">
          Transform natural language app specifications into fully functional
          web applications. Sign in to get started creating your own
          applications!
        </p>

        <SignUpButton mode="modal">
          <Button size="lg">Get Started</Button>
        </SignUpButton>
      </div>
    </div>
  );
}

function Dashboard() {
  const projects = useQuery(api.projects.list);

  if (projects === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-gray-800">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Schema Spark</h1>
        <p className="text-xl text-gray-600">
          Spec-to-App Mini Agent with Convex, Next.js, and LLM Ops
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Create New Project</h2>
          <p className="mb-4">
            Start a new project by providing a natural language specification of
            your application.
          </p>
          <Link
            href="/projects/new"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
          >
            New Project
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">
            My Projects ({projects.length})
          </h2>
          <p className="mb-4">
            View and manage your existing projects, artifacts, and runs.
          </p>
          <Link
            href="/projects"
            className="inline-block bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded"
          >
            View Projects
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Evaluations</h2>
          <p className="mb-4">
            View benchmark results across models and prompts.
          </p>
          <Link
            href="/evals"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded"
          >
            View Evals
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Prompt Registry</h2>
          <p className="mb-4">
            Manage and version prompt templates for the agent.
          </p>
          <Link
            href="/prompts"
            className="inline-block bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded"
          >
            Manage Prompts
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Golden Specs</h2>
          <p className="mb-4">View and manage canonical test specifications.</p>
          <Link
            href="/specs"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded"
          >
            Golden Specs
          </Link>
        </div>
      </div>
    </div>
  );
}
