# Schema Spark

> Spec-to-App Mini Agent with Convex, Next.js, and LLM Ops

## Overview

Schema Spark is a web application that transforms natural language app specifications into fully functional web applications. It uses an AI agent to plan, generate, validate, and persist a minimal full-stack app using Next.js (frontend) and Convex (backend). The system provides evals, observability, and benchmarking across multiple golden tasks and models.

## Features

- **Natural Language to Code**: Turn a short app spec (e.g., "Todos with title, done; add/edit/filter; save per user") into:
  - Convex data model (schema.ts)
  - Convex queries/mutations/actions for CRUD operations
  - React/Next UI (components/pages/hooks)
- **Artifact Management**: Persist generated artifacts as versioned "files" in Convex
- **Live Previews**: Preview and run the generated app in-browser with WebContainers
- **Evaluation System**: Provides evals and observability (latency, token usage, pass rate, error types)
- **Multiple Models**: Compare multiple prompts/models with a leaderboard
- **Authentication**: User authentication via Clerk

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, shadcn/ui, Monaco Editor
- **Backend**: Convex (schema, queries, mutations, actions)
- **Auth**: Clerk
- **LLM Provider**: OpenAI SDK interface with pluggable provider abstraction
- **In-Browser Execution**: WebContainers for running generated apps directly in the browser

## Data Model

- **users**: User information including ID, email, and creation timestamp
- **projects**: Project information with owner reference, name, and creation timestamp
- **artifacts**: Versioned file content with project reference, path, content, and version
- **runs**: Records of agent executions including status, model, and metrics
- **evals**: Evaluation results of runs against golden tasks
- **specs**: Golden tasks with assertions for testing
- **prompts**: Versioned prompt templates
- **envs**: WebContainer configuration for previews

## Getting Started

### Prerequisites

- Node.js (version 18+)
- Bun package manager
- Clerk account
- Convex account
- OpenAI API key

### Installation

1. Clone the repository:

   ```
   git clone https://github.com/yourusername/schema-spark.git
   cd schema-spark
   ```
2. Install dependencies:

   ```
   bun install
   ```
3. Set up environment variables:

   - Create a `.env.local` file with the following variables:
     ```
     NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your-clerk-publishable-key"
     CLERK_SECRET_KEY="your-clerk-secret-key"
     OPENAI_API_KEY="your-openai-api-key"
     ```
   - In your Convex dashboard, add the Clerk JWT issuer URL as `CLERK_JWT_ISSUER_DOMAIN`
4. Start the development server:

   ```
   bun dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) to see the application

## Usage

1. Sign in with your Clerk account
2. Create a new project
3. Enter a natural language specification for your application
4. Click "Generate App" to start the generation process
5. View the generated code artifacts
6. Preview the application in the browser using WebContainers

## WebContainers Integration

The application uses WebContainers to provide in-browser previews of generated applications without requiring additional server infrastructure. This allows users to test and interact with their generated applications instantly in a sandboxed environment.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
