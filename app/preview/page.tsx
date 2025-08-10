"use client";

import { Button } from "@/components/ui/button";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { SignInButton } from "@clerk/nextjs";
import { Header } from "@/components/layout/header";

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

  // For this MVP, we'll "render" the Todo app using the content from artifacts
  const [loading, setLoading] = useState(false);
  const [todos, setTodos] = useState<
    { _id: string; title: string; done: boolean }[]
  >([]);
  const [newTodo, setNewTodo] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);

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

  // Handler for adding a new todo
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    // Generate a random ID for the todo
    const _id = Math.random().toString(36).substring(2, 15);

    setTodos([...todos, { _id, title: newTodo, done: false }]);
    setNewTodo("");
  };

  // Handler for toggling a todo's completion status
  const handleToggleTodo = (_id: string) => {
    setTodos(
      todos.map((todo) =>
        todo._id === _id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  // Handler for deleting a todo
  const handleDeleteTodo = (_id: string) => {
    setTodos(todos.filter((todo) => todo._id !== _id));
  };

  // Filter todos based on showCompleted setting
  const filteredTodos = showCompleted
    ? todos
    : todos.filter((todo) => !todo.done);

  return (
    <div className="flex-1 p-6 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {project?.name || "App"} Preview
          </h1>
          <p className="text-sm text-gray-500">
            This is a mockup of your generated app
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectId}`}>Back to Project</Link>
        </Button>
      </div>

      <div className="flex-1 bg-gray-50 rounded-lg p-6 flex items-center justify-center">
        <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Todo App</h1>

          <form onSubmit={handleAddTodo} className="mb-4 flex">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="Add a new todo..."
              className="flex-1 px-4 py-2 border rounded-l-lg focus:outline-none"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-r-lg"
            >
              Add
            </button>
          </form>

          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={() => setShowCompleted(!showCompleted)}
                className="mr-2"
              />
              Show completed tasks
            </label>
          </div>

          <ul className="space-y-2">
            {filteredTodos.map((todo) => (
              <li
                key={todo._id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => handleToggleTodo(todo._id)}
                    className="mr-3"
                  />
                  <span
                    className={todo.done ? "line-through text-gray-500" : ""}
                  >
                    {todo.title}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteTodo(todo._id)}
                  className="text-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          {filteredTodos.length === 0 && (
            <p className="text-center text-gray-500 mt-4">No todos yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
