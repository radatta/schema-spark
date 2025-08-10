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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusIcon, Trash2Icon } from "lucide-react";

export default function SpecsPage() {
  return (
    <>
      <Header />
      <main className="container mx-auto py-6 px-4">
        <Authenticated>
          <SpecsList />
        </Authenticated>
        <Unauthenticated>
          <div className="flex flex-col items-center justify-center py-12">
            <h1 className="text-2xl font-bold mb-4">Sign in Required</h1>
            <p className="mb-6">
              Please sign in to view and manage golden specs.
            </p>
            <SignInButton mode="modal">
              <Button>Sign In</Button>
            </SignInButton>
          </div>
        </Unauthenticated>
      </main>
    </>
  );
}

function SpecsList() {
  const specs = useQuery(api.specs.list);
  const createSpec = useMutation(api.specs.create);
  const removeSpec = useMutation(api.specs.remove);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSpec, setNewSpec] = useState({
    title: "",
    inputSpec: "",
    assertions: [
      {
        description: "Schema defines required fields and types",
        type: "schema",
      },
      {
        description: "CRUD mutations succeed and return expected shapes",
        type: "mutation",
      },
      { description: "Queries filter/sort correctly", type: "query" },
      {
        description: "UI renders list view without runtime errors",
        type: "ui",
      },
    ],
  });

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [specToDelete, setSpecToDelete] = useState<any>(null);

  const handleCreateSpec = async () => {
    if (!newSpec.title || !newSpec.inputSpec) return;

    try {
      console.log("Creating spec:", newSpec);
      await createSpec({
        title: newSpec.title,
        inputSpec: newSpec.inputSpec,
        assertions: newSpec.assertions,
      });

      setIsCreateDialogOpen(false);
      setNewSpec({
        title: "",
        inputSpec: "",
        assertions: [
          {
            description: "Schema defines required fields and types",
            type: "schema",
          },
          {
            description: "CRUD mutations succeed and return expected shapes",
            type: "mutation",
          },
          { description: "Queries filter/sort correctly", type: "query" },
          {
            description: "UI renders list view without runtime errors",
            type: "ui",
          },
        ],
      });
    } catch (error) {
      console.error("Error creating spec:", error);
      alert("Failed to create spec. Check console for details.");
    }
  };

  const handleDeleteClick = (spec: any) => {
    setSpecToDelete(spec);
    setIsDeleteAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (specToDelete) {
      await removeSpec({ id: specToDelete._id });
    }
    setIsDeleteAlertOpen(false);
    setSpecToDelete(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Golden Specs</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Add Golden Spec
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Golden Spec</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateSpec();
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Title
                  </Label>
                  <Input
                    id="title"
                    value={newSpec.title}
                    onChange={(e) =>
                      setNewSpec({ ...newSpec, title: e.target.value })
                    }
                    className="col-span-3"
                    placeholder="e.g., Todo App"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="inputSpec" className="text-right">
                    Input Spec
                  </Label>
                  <Textarea
                    id="inputSpec"
                    value={newSpec.inputSpec}
                    onChange={(e) =>
                      setNewSpec({ ...newSpec, inputSpec: e.target.value })
                    }
                    className="col-span-3"
                    rows={8}
                    placeholder="Todos with title, done; add/edit/filter; save per user"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <Label className="text-right pt-2">Assertions</Label>
                  <div className="col-span-3 space-y-2">
                    {newSpec.assertions.map((assertion, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          value={assertion.description}
                          onChange={(e) => {
                            const newAssertions = [...newSpec.assertions];
                            newAssertions[index].description = e.target.value;
                            setNewSpec({
                              ...newSpec,
                              assertions: newAssertions,
                            });
                          }}
                          className="flex-1"
                        />
                        <Input
                          value={assertion.type}
                          onChange={(e) => {
                            const newAssertions = [...newSpec.assertions];
                            newAssertions[index].type = e.target.value;
                            setNewSpec({
                              ...newSpec,
                              assertions: newAssertions,
                            });
                          }}
                          className="w-24"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const newAssertions = newSpec.assertions.filter(
                              (_, i) => i !== index
                            );
                            setNewSpec({
                              ...newSpec,
                              assertions: newAssertions,
                            });
                          }}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewSpec({
                          ...newSpec,
                          assertions: [
                            ...newSpec.assertions,
                            { description: "", type: "custom" },
                          ],
                        });
                      }}
                    >
                      Add Assertion
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={!newSpec.title || !newSpec.inputSpec}
                >
                  Create Spec
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {specs === undefined ? (
            <div className="p-4">
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full mb-4" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : specs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                No golden specs found. Create your first one!
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead>Assertions</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specs.map((spec) => (
                  <TableRow key={spec._id}>
                    <TableCell className="font-medium">{spec.title}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {spec.inputSpec}
                    </TableCell>
                    <TableCell>{spec.assertions.length} assertions</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(spec)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the spec "{specToDelete?.title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
