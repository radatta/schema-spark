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
- **StackBlitz IDE Integration**: Embedded IDE with real-time code streaming from LLM generation
- **Multi-File Agentic Framework**: Specialized agents for different aspects of code generation (planning, components, backend, styling)
- **Real-time Code Streaming**: Live updates as code is generated, displayed in embedded StackBlitz IDE
- **Evaluation System**: Provides evals and observability (latency, token usage, pass rate, error types)
- **Multiple Models**: Compare multiple prompts/models with a leaderboard
- **Authentication**: User authentication via Clerk

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, shadcn/ui, Monaco Editor, StackBlitz SDK
- **Backend**: Convex (schema, queries, mutations, actions)
- **Auth**: Clerk
- **LLM Provider**: OpenAI SDK interface with pluggable provider abstraction
- **In-Browser Execution**: WebContainers for running generated apps directly in the browser
- **Code Streaming**: Server-Sent Events for real-time code generation display
- **Multi-Agent System**: Specialized agents for planning, component generation, backend generation, and styling

## Data Model

- **users**: User information including ID, email, and creation timestamp
- **projects**: Project information with owner reference, name, and creation timestamp
- **artifacts**: Versioned file content with project reference, path, content, and version
- **runs**: Records of agent executions including status, model, and metrics
- **evals**: Evaluation results of runs against golden tasks
- **specs**: Golden tasks with assertions for testing
- **prompts**: Versioned prompt templates
- **envs**: WebContainer configuration for previews

## Architecture

### Multi-Agent Generation System

The application employs a sophisticated multi-agent architecture for code generation:

#### Core Agents
- **Planning Agent** (`/lib/agents/planning-agent.ts`): Analyzes user requirements and determines Next.js architecture
- **Generation Orchestrator** (`/lib/agents/generation-orchestrator.ts`): Coordinates agent execution and manages dependencies
- **Component Agent** (`/lib/agents/component-agent.ts`): Generates React components and UI logic
- **Backend Agent**: Creates Convex schemas, queries, and mutations
- **Styling Agent**: Handles CSS and design implementation

#### Generation Flow
1. **Planning Phase**: Planning agent analyzes spec and creates file breakdown
2. **Orchestration**: Orchestrator manages parallel/sequential generation based on dependencies
3. **Real-time Streaming**: Code streams to StackBlitz IDE via Server-Sent Events
4. **Persistence**: Completed artifacts saved to Convex for version control
5. **Preview**: WebContainers provide instant in-browser execution

#### Streaming Architecture
- **API Routes**: Handle LLM streaming and real-time client updates (`/app/api/stream-generate/`)
- **Convex**: Manages data persistence, queries, and business logic
- **Hybrid Approach**: Combines streaming performance with robust data layer

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
4. Click "Generate App" to start the AI-powered generation process
5. Watch real-time code generation in the embedded StackBlitz IDE
6. Preview the application directly in the browser using WebContainers
7. Iterate and refine your specifications as needed

### Key Features in Action

- **Real-time Generation**: See code being written live as the AI agents work
- **Instant Previews**: Test your generated app immediately without setup
- **Multi-Agent Coordination**: Specialized agents handle different aspects (UI, backend, styling)
- **Version Control**: All artifacts are versioned and stored in Convex
- **Performance Metrics**: Track generation time, token usage, and success rates

## WebContainers Integration

The application uses WebContainers to provide in-browser previews of generated applications without requiring additional server infrastructure. This allows users to test and interact with their generated applications instantly in a sandboxed environment.

## Development Specifications

The project has evolved through multiple specification iterations:

### Core Spec (spec.md)
The foundational specification defining the basic MVP with natural language to code generation, artifact management, and evaluation systems.

### WebContainers Integration (spec2.md)
**Post-MVP Enhancement**: Introduces browser-native micro-OS running Node.js entirely in the user's tab for live, isolated previews with zero server infrastructure. Features sub-2-second startup times and client-side execution.

### StackBlitz IDE Integration (spec3.md)
**Code Streaming Enhancement**: Replaces individual code artifact cards with an embedded StackBlitz IDE that receives real-time code generation streams from the LLM. Implements a hybrid architecture using API routes for streaming and Convex for persistence.

### Multi-File Agentic Framework (spec4.md)
**Advanced Generation System**: Comprehensive multi-file agentic framework with specialized agents:
- **Planning Agent**: Analyzes requirements and determines architecture
- **Generation Orchestrator**: Coordinates agent execution and handles dependencies
- **Component Agent**: Generates React components and UI logic
- **Backend Agent**: Creates Convex schemas, queries, and mutations
- **Styling Agent**: Handles CSS and design implementation

Each specification builds upon the previous ones, creating a robust, scalable system for automated Next.js application generation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
