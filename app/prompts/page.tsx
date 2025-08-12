"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Authenticated, Unauthenticated } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

export default function PromptsPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto py-6 px-4">
        <Authenticated>
          <PromptsList />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">Please sign in to view and manage prompts.</p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function PromptsList() {
  const prompts = useQuery(api.prompts.list);
  const createPrompt = useMutation(api.prompts.create);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: "",
    version: "",
    template: "",
    notes: "",
  });

  const handleCreatePrompt = async () => {
    await createPrompt({
      name: newPrompt.name,
      version: newPrompt.version,
      template: newPrompt.template,
      notes: newPrompt.notes || undefined,
    });
    setIsCreateDialogOpen(false);
    setNewPrompt({ name: "", version: "", template: "", notes: "" });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Prompt Templates</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>Create New Prompt</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Prompt Template</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={newPrompt.name}
                  onChange={(e) =>
                    setNewPrompt({ ...newPrompt, name: e.target.value })
                  }
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="version" className="text-right">
                  Version
                </Label>
                <Input
                  id="version"
                  value={newPrompt.version}
                  onChange={(e) =>
                    setNewPrompt({ ...newPrompt, version: e.target.value })
                  }
                  className="col-span-3"
                  placeholder="e.g., v1.0.0"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="template" className="text-right">
                  Template
                </Label>
                <Textarea
                  id="template"
                  value={newPrompt.template}
                  onChange={(e) =>
                    setNewPrompt({ ...newPrompt, template: e.target.value })
                  }
                  className="col-span-3"
                  rows={10}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={newPrompt.notes}
                  onChange={(e) =>
                    setNewPrompt({ ...newPrompt, notes: e.target.value })
                  }
                  className="col-span-3"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => void handleCreatePrompt()}>Create Prompt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {prompts === undefined ? (
            <div className="p-4">
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : prompts.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                No prompt templates found. Create your first one!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prompts.map((prompt) => (
                  <PromptRow key={prompt._id} prompt={prompt} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PromptRow({ prompt }: { prompt: any }) {
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  return (
    <TableRow>
      <TableCell className="font-medium">{prompt.name}</TableCell>
      <TableCell>
        <Badge variant="outline">{prompt.version}</Badge>
      </TableCell>
      <TableCell>{format(prompt.createdAt, "MMM d, yyyy")}</TableCell>
      <TableCell>
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              View
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>
                {prompt.name} ({prompt.version})
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="template">
              <TabsList className="mb-4">
                <TabsTrigger value="template">Template</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="template">
                <div className="bg-muted p-4 rounded-md">
                  <pre className="whitespace-pre-wrap">{prompt.template}</pre>
                </div>
              </TabsContent>
              <TabsContent value="notes">
                {prompt.notes ? (
                  <div className="bg-muted p-4 rounded-md">
                    <p className="whitespace-pre-wrap">{prompt.notes}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No notes available
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
