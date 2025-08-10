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
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent } from "react";

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
  const runAgent = useAction(api.agent.run);
  const router = useRouter();

  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

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
      const projectId = await createProject({ name: name.trim() });

      // Run the agent with the spec
      await runAgent({
        projectId,
        inputSpec: spec.trim(),
        model: "gpt-4-turbo", // Default model for MVP
        promptVersion: "v1", // Default prompt version for MVP
      });

      // Navigate to the project page
      router.push(`/projects/${projectId}`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                  className="min-h-[150px]"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Example: {exampleSpec}
                </p>
              </div>

              {error && <div className="text-red-500 text-sm">{error}</div>}
            </div>

            <div className="mt-6">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Generating App..." : "Generate App"}
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
