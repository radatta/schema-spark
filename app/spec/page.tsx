"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";

export default function SpecPage() {
  const [spec, setSpec] = useState<string>("");

  useEffect(() => {
    // Fetch the spec markdown content
    fetch("/spec.md")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load spec");
        }
        return response.text();
      })
      .then((text) => {
        setSpec(text);
      })
      .catch((error) => {
        console.error("Error loading spec:", error);
      });
  }, []);

  return (
    <>
      <Header />
      <main className="container mx-auto py-6 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Specification</h1>
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {spec ? (
                <div className="whitespace-pre-wrap font-mono text-sm">
                  {spec}
                </div>
              ) : (
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
