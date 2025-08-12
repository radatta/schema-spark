import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  try {
    const runId = params.runId as Id<"runs">;
    const body = await request.json();
    const { projectId, inputSpec, model = "gpt-4-turbo", _promptVersion = "v1", authToken } = body;

    if (!authToken) {
      return NextResponse.json(
        { error: "Authentication token required" },
        { status: 401 }
      );
    }

    // Initialize Convex client with auth token
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(authToken);

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        // Helper function to send SSE data
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        try {
          // Update run status to "planning"
          await convex.mutation(api.runs.update, {
            id: runId,
            status: "planning",
            timings: { planMs: 0 },
          });

          sendEvent("status", { phase: "planning", message: "Planning application structure..." });

          // Phase 1: Planning
          const planResponse = await openai.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content: `You are an expert full-stack developer who specializes in creating applications with Next.js, React, and Convex.
                 Your task is to plan the structure of an application based on the given specification.
                 Outline the main components, database schema, and API endpoints that will be needed.
                 Be concise but comprehensive.`
              },
              {
                role: "user",
                content: `Create a detailed plan for: ${inputSpec}`
              }
            ],
            stream: true, // Enable streaming
          });

          let planContent = "";
          for await (const chunk of planResponse) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              planContent += delta;
              sendEvent("plan_chunk", { content: delta, accumulated: planContent });
            }
          }

          sendEvent("plan_complete", { content: planContent });

          // Update run status to "generating"
          await convex.mutation(api.runs.update, {
            id: runId,
            status: "generating",
          });

          sendEvent("status", { phase: "generating", message: "Generating application files..." });

          // Phase 2: Generate Schema
          await generateSchema(sendEvent, planContent, inputSpec, model, projectId, convex);

          // Phase 3: Generate Queries
          await generateQueries(sendEvent, planContent, inputSpec, model, projectId, convex);

          // Phase 4: Generate Mutations  
          await generateMutations(sendEvent, planContent, inputSpec, model, projectId, convex);

          // Phase 5: Generate UI
          await generateUI(sendEvent, planContent, inputSpec, model, projectId, convex);

          // Complete the run
          await convex.mutation(api.runs.update, {
            id: runId,
            status: "completed",
          });

          sendEvent("complete", { message: "Generation completed successfully!" });

        } catch (error) {
          console.error("Streaming error:", error);
          sendEvent("error", { 
            message: error instanceof Error ? error.message : "An unknown error occurred" 
          });

          // Update run status to failed
          await convex.mutation(api.runs.update, {
            id: runId,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    console.error("API route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Helper function to generate schema with streaming
async function generateSchema(
  sendEvent: (event: string, data: any) => void,
  plan: string,
  inputSpec: string,
  model: string,
  projectId: Id<"projects">,
  convex: ConvexHttpClient
) {
  sendEvent("status", { phase: "schema", message: "Generating database schema..." });

  const schemaResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are an expert at designing Convex database schemas.
         Create a complete schema.ts file that defines all the tables needed for the application.
         Use proper Convex table definitions with appropriate field types and indexes.
         Include all necessary imports and exports.`
      },
      {
        role: "user",
        content: `Based on this plan:\n${plan}\n\nCreate a schema.ts file for: ${inputSpec}`
      }
    ],
    stream: true,
  });

  let schemaContent = "";
  for await (const chunk of schemaResponse) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      schemaContent += delta;
      sendEvent("file_chunk", { 
        filePath: "convex/schema.ts", 
        content: delta, 
        accumulated: schemaContent 
      });
    }
  }

  // Save completed schema to Convex
  await convex.mutation(api.artifacts.upsert, {
    projectId,
    path: "convex/schema.ts",
    content: schemaContent,
  });

  sendEvent("file_complete", { filePath: "convex/schema.ts", content: schemaContent });
}

// Helper function to generate queries with streaming
async function generateQueries(
  sendEvent: (event: string, data: any) => void,
  plan: string,
  inputSpec: string,
  model: string,
  projectId: Id<"projects">,
  convex: ConvexHttpClient
) {
  sendEvent("status", { phase: "queries", message: "Generating database queries..." });

  const queriesResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are an expert at creating Convex database queries.
         Create comprehensive query functions for reading data from the database.
         Use proper Convex query patterns and include all necessary imports.`
      },
      {
        role: "user",
        content: `Based on this plan:\n${plan}\n\nCreate query functions for: ${inputSpec}`
      }
    ],
    stream: true,
  });

  let queriesContent = "";
  for await (const chunk of queriesResponse) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      queriesContent += delta;
      sendEvent("file_chunk", { 
        filePath: "convex/queries.ts", 
        content: delta, 
        accumulated: queriesContent 
      });
    }
  }

  // Save completed queries to Convex
  await convex.mutation(api.artifacts.upsert, {
    projectId,
    path: "convex/queries.ts",
    content: queriesContent,
  });

  sendEvent("file_complete", { filePath: "convex/queries.ts", content: queriesContent });
}

// Helper function to generate mutations with streaming
async function generateMutations(
  sendEvent: (event: string, data: any) => void,
  plan: string,
  inputSpec: string,
  model: string,
  projectId: Id<"projects">,
  convex: ConvexHttpClient
) {
  sendEvent("status", { phase: "mutations", message: "Generating database mutations..." });

  const mutationsResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are an expert at creating Convex database mutations.
         Create comprehensive mutation functions for writing data to the database.
         Use proper Convex mutation patterns and include all necessary imports.`
      },
      {
        role: "user",
        content: `Based on this plan:\n${plan}\n\nCreate mutation functions for: ${inputSpec}`
      }
    ],
    stream: true,
  });

  let mutationsContent = "";
  for await (const chunk of mutationsResponse) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      mutationsContent += delta;
      sendEvent("file_chunk", { 
        filePath: "convex/mutations.ts", 
        content: delta, 
        accumulated: mutationsContent 
      });
    }
  }

  // Save completed mutations to Convex
  await convex.mutation(api.artifacts.upsert, {
    projectId,
    path: "convex/mutations.ts",
    content: mutationsContent,
  });

  sendEvent("file_complete", { filePath: "convex/mutations.ts", content: mutationsContent });
}

// Helper function to generate UI with streaming
async function generateUI(
  sendEvent: (event: string, data: any) => void,
  plan: string,
  inputSpec: string,
  model: string,
  projectId: Id<"projects">,
  convex: ConvexHttpClient
) {
  sendEvent("status", { phase: "ui", message: "Generating user interface..." });

  const uiResponse = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are an expert React and Next.js developer.
         Create a complete React component that implements the user interface for the application.
         Use modern React patterns, TypeScript, and Tailwind CSS for styling.
         Include proper Convex integration for data fetching and mutations.`
      },
      {
        role: "user",
        content: `Based on this plan:\n${plan}\n\nCreate the main UI component for: ${inputSpec}`
      }
    ],
    stream: true,
  });

  let uiContent = "";
  for await (const chunk of uiResponse) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      uiContent += delta;
      sendEvent("file_chunk", { 
        filePath: "app/page.tsx", 
        content: delta, 
        accumulated: uiContent 
      });
    }
  }

  // Save completed UI to Convex
  await convex.mutation(api.artifacts.upsert, {
    projectId,
    path: "app/page.tsx",
    content: uiContent,
  });

  sendEvent("file_complete", { filePath: "app/page.tsx", content: uiContent });
}
