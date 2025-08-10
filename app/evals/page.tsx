"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery, useAction } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckIcon, XIcon } from "lucide-react";

export default function Evaluations() {
  const [selectedModel, setSelectedModel] = useState("all");
  const [selectedPromptVersion, setSelectedPromptVersion] = useState("all");
  const [runningBatch, setRunningBatch] = useState(false);

  const prompts = useQuery(api.prompts.list);
  const leaderboard = useQuery(api.evals.getLeaderboard, {
    promptVersion:
      selectedPromptVersion !== "all" ? selectedPromptVersion : undefined,
    model: selectedModel !== "all" ? selectedModel : undefined,
  });
  const runBatchEval = useAction(api.evals.runBatch);
  const specs = useQuery(api.specs.list);

  const handleRunBatchEval = async () => {
    if (!specs || specs.length === 0) {
      alert("No specs available for evaluation.");
      return;
    }

    setRunningBatch(true);
    try {
      await runBatchEval({
        promptVersion:
          selectedPromptVersion !== "all" ? selectedPromptVersion : undefined,
        model: selectedModel !== "all" ? selectedModel : undefined,
        specIds: specs.map((spec) => spec._id),
      });
      alert("Batch evaluations complete!");
    } catch (error) {
      console.error("Error running batch evaluations:", error);
      alert("Error running batch evaluations.");
    } finally {
      setRunningBatch(false);
    }
  };

  // Get unique models from the leaderboard
  const models = leaderboard
    ? Array.from(new Set(leaderboard.map((entry: any) => entry.model)))
    : [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Model Evaluations</h1>
        <Button onClick={handleRunBatchEval} disabled={runningBatch}>
          {runningBatch ? "Running..." : "Run Batch Evaluation"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Filter by Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Models</SelectItem>
                {models.map((model, index) => (
                  <SelectItem key={index} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Filter by Prompt Version
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedPromptVersion}
              onValueChange={setSelectedPromptVersion}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Versions</SelectItem>
                {prompts?.map((prompt, index) => (
                  <SelectItem key={index} value={prompt.version}>
                    {prompt.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Evaluations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {leaderboard
                ? leaderboard.reduce((sum, entry) => sum + entry.evalCount, 0)
                : 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Average Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {leaderboard && leaderboard.length > 0
                ? Math.round(
                    (leaderboard.reduce(
                      (sum, entry) => sum + entry.passRate * entry.evalCount,
                      0
                    ) /
                      leaderboard.reduce(
                        (sum, entry) => sum + entry.evalCount,
                        0
                      )) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cards">
        <TabsList className="mb-4">
          <TabsTrigger value="cards">Cards View</TabsTrigger>
          <TabsTrigger value="table">Table View</TabsTrigger>
        </TabsList>

        <TabsContent value="cards">
          {leaderboard && leaderboard.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaderboard.map((entry, index) => (
                <Card key={index}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <CardTitle>{entry.model}</CardTitle>
                      <Badge
                        variant={
                          entry.passRate > 0.8
                            ? "default"
                            : entry.passRate > 0.5
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {Math.round(entry.passRate * 100)}% Pass Rate
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.promptVersion} • {entry.evalCount} evaluations
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Functionality</span>
                          <span>
                            {entry.avgMetrics.functionality.toFixed(1)}/10
                          </span>
                        </div>
                        <Progress value={entry.avgMetrics.functionality * 10} />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Code Quality</span>
                          <span>
                            {entry.avgMetrics.codeQuality.toFixed(1)}/10
                          </span>
                        </div>
                        <Progress value={entry.avgMetrics.codeQuality * 10} />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Design</span>
                          <span>{entry.avgMetrics.design.toFixed(1)}/10</span>
                        </div>
                        <Progress value={entry.avgMetrics.design * 10} />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Performance</span>
                          <span>
                            {entry.avgMetrics.performance.toFixed(1)}/10
                          </span>
                        </div>
                        <Progress value={entry.avgMetrics.performance * 10} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Avg. Latency
                          </p>
                          <p className="font-medium">
                            {Math.round(entry.avgLatency / 1000)}s
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Avg. Tokens
                          </p>
                          <p className="font-medium">
                            {Math.round(entry.avgTokenUsage).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Avg. Cost
                          </p>
                          <p className="font-medium">
                            ${entry.avgCost.toFixed(3)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  No evaluation data available.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Run batch evaluations to see results here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="table">
          {leaderboard && leaderboard.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Prompt Version</TableHead>
                    <TableHead>Pass Rate</TableHead>
                    <TableHead>Functionality</TableHead>
                    <TableHead>Code Quality</TableHead>
                    <TableHead>Design</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Avg. Latency</TableHead>
                    <TableHead>Avg. Tokens</TableHead>
                    <TableHead>Avg. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {entry.model}
                      </TableCell>
                      <TableCell>{entry.promptVersion}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.passRate > 0.8
                              ? "default"
                              : entry.passRate > 0.5
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {Math.round(entry.passRate * 100)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {entry.avgMetrics.functionality.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        {entry.avgMetrics.codeQuality.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        {entry.avgMetrics.design.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        {entry.avgMetrics.performance.toFixed(1)}
                      </TableCell>
                      <TableCell>
                        {Math.round(entry.avgLatency / 1000)}s
                      </TableCell>
                      <TableCell>
                        {Math.round(entry.avgTokenUsage).toLocaleString()}
                      </TableCell>
                      <TableCell>${entry.avgCost.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">
                  No evaluation data available.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Run batch evaluations to see results here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
