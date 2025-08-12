"use client";

import { Button } from "@/components/ui/button";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Header } from "@/components/layout/header";
import { SignInButton } from "@clerk/nextjs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

export default function EvalPage() {
  const params = useParams();
  const projectId = params.id as string;
  const router = useRouter();

  return (
    <>
      <Header />
      <main className="container mx-auto py-6">
        <Authenticated>
          <ProjectEvals projectId={projectId as unknown as Id<"projects">} />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">Please sign in to view evaluation results.</p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function ProjectEvals({ projectId }: { projectId: Id<"projects"> }) {
  const project = useQuery(api.projects.get, { id: projectId });
  const evals = useQuery(api.evals.byProject, { projectId }) || [];

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Calculate overall metrics for the project
  const metrics = {
    functionalityScore: 0,
    codeQualityScore: 0,
    designScore: 0,
    performanceScore: 0,
    overallScore: 0,
    evaluationCount: evals.length,
  };

  if (evals.length > 0) {
    evals.forEach((evalItem) => {
      metrics.functionalityScore += evalItem.metrics?.functionality || 0;
      metrics.codeQualityScore += evalItem.metrics?.codeQuality || 0;
      metrics.designScore += evalItem.metrics?.design || 0;
      metrics.performanceScore += evalItem.metrics?.performance || 0;
    });

    metrics.functionalityScore = metrics.functionalityScore / evals.length;
    metrics.codeQualityScore = metrics.codeQualityScore / evals.length;
    metrics.designScore = metrics.designScore / evals.length;
    metrics.performanceScore = metrics.performanceScore / evals.length;
    metrics.overallScore =
      (metrics.functionalityScore +
        metrics.codeQualityScore +
        metrics.designScore +
        metrics.performanceScore) /
      4;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">
            {project?.name || "Project"} Evaluations
          </h1>
          <p className="text-gray-500">
            View the performance evaluations for this project
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>Back to Project</Link>
          </Button>
        </div>
      </div>

      {evals.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 rounded-lg">
          <h2 className="text-xl font-medium mb-2">No Evaluations Yet</h2>
          <p className="text-gray-500 mb-4">
            Once your app is generated, it will be evaluated against quality
            metrics.
          </p>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}`}>Go Back to Project</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.overallScore.toFixed(1)}/10
                </div>
                <Progress
                  value={metrics.overallScore * 10}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Functionality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.functionalityScore.toFixed(1)}/10
                </div>
                <Progress
                  value={metrics.functionalityScore * 10}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Code Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.codeQualityScore.toFixed(1)}/10
                </div>
                <Progress
                  value={metrics.codeQualityScore * 10}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Design</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.designScore.toFixed(1)}/10
                </div>
                <Progress
                  value={metrics.designScore * 10}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.performanceScore.toFixed(1)}/10
                </div>
                <Progress
                  value={metrics.performanceScore * 10}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Evaluation History</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evals.map((evalItem) => (
                    <TableRow key={evalItem._id}>
                      <TableCell className="font-medium">
                        {evalItem._creationTime
                          ? format(
                              new Date(evalItem._creationTime),
                              "MMM d, yyyy"
                            )
                          : "N/A"}
                      </TableCell>
                      <TableCell>v{evalItem.version || "1.0"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            evalItem.status === "completed"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {evalItem.status || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {evalItem.metrics
                          ? (
                              (evalItem.metrics.functionality +
                                evalItem.metrics.codeQuality +
                                evalItem.metrics.design +
                                evalItem.metrics.performance) /
                              4
                            ).toFixed(1)
                          : "N/A"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {evalItem.feedback || "No feedback available"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
