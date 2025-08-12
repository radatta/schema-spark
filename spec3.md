# Spec 3: StackBlitz IDE Integration with Code Streaming

## Overview

Replace the current code viewing system (individual cards with syntax highlighting) with an embedded StackBlitz IDE that can receive real-time code generation streams from the LLM.

## Current State

- Code artifacts displayed as individual cards with `CodeHighlight` component
- Each file shown separately with limited height (300px)
- Separate preview functionality via `/preview?projectId=` route
- Code generation happens in batch, stored in Convex, then displayed

## Proposed Changes

### 1. Replace Code Display

- **Remove**: Individual artifact cards in `ArtifactsTab`
- **Add**: Embedded StackBlitz IDE using `@stackblitz/sdk`
- **Remove**: Preview button and `/preview` route (StackBlitz has built-in preview)

### 2. Code Streaming Architecture ✅ OPTIMAL SOLUTION

**Hybrid Approach: API Routes for Streaming + Convex for Persistence**

#### ✅ **Final Architecture Decision**

- **API Routes**: Handle LLM streaming and real-time client updates
- **Convex**: Handle data persistence, queries, and business logic
- **Best of both worlds**: Streaming performance + robust data layer

#### Architecture Flow:

```
1. User clicks "Generate" → API route starts streaming
2. API route streams to client → StackBlitz updates in real-time  
3. When files complete → API route saves to Convex
4. Other users/sessions → Query Convex for persisted data
```

#### Implementation:

```typescript
// API Route: /app/api/stream-generate/[runId]/route.ts
export async function POST() {
  // 1. Stream LLM responses to client via Server-Sent Events
  // 2. When each file completes → save to Convex via API
  // 3. Update run status in Convex
}

// Frontend: Hybrid consumption
const stream = useStreamingGeneration(runId);        // API route streaming
const artifacts = useQuery(api.artifacts.byProject); // Convex persistence
const runs = useQuery(api.runs.byProject);          // Convex queries
```

#### Benefits:

- **Performance**: API routes optimized for streaming
- **Persistence**: Convex handles data storage beautifully
- **Type Safety**: Keep existing Convex generated types
- **Minimal Migration**: Preserve existing schemas/queries/mutations
- **Future-Proof**: Can optimize each layer independently

### 3. StackBlitz Integration Details

- Use `@stackblitz/sdk` to embed project
- Initialize with **empty project** (no template needed since we provide all code)
- Stream files as they're generated using `applyFsDiff`:
  ```js
  // Start with empty project
  const vm = await sdk.embedProject(containerRef.current, {
    title: project.name,
    files: {}, // Start completely empty
    template: 'node' // Minimal template
  });

  // Stream files as they're generated
  vm.applyFsDiff({
    create: {
      [filePath]: accumulatedContent // Full content as it streams in
    }
  });
  ```

### 4. UI Changes

- Replace `Tabs` with StackBlitz taking primary real estate
- Keep run history in sidebar or bottom panel
- Remove preview button from header
- Add streaming status indicators

## Technical Concerns & Questions

### 1. StackBlitz Streaming Capabilities ✅ SOLVED

- **Solution**: Use `applyFsDiff` method for real-time file updates
- **Approach**: Accumulate streaming content and update full file content frequently
- **Capabilities**: Create/update/delete files + full editor control via VM API
- **User Experience**: Files appear and grow in real-time, preview updates automatically

### 2. Convex Streaming Limitations ✅ SOLVED

- **Solution**: Use API routes for streaming, Convex for persistence
- **Benefits**: Best streaming performance + robust data management
- **Migration**: Minimal - keep existing Convex schemas and queries
- **Separation**: API routes handle real-time, Convex handles everything else

### 3. LLM Integration ✅ ARCHITECTURAL CHANGE DEFINED

- **Current**: Agent runs in Convex action, returns complete result
- **New Approach**: Move LLM streaming to API routes, keep Convex for persistence
- **Migration Strategy**:
  1. Create API route with streaming LLM calls (OpenAI `stream: true`)
  2. Stream to client via Server-Sent Events
  3. Save completed files to Convex using existing mutations
  4. Keep all existing Convex business logic and type safety

### 4. Project Navigation

- **Current**: Generate from `/projects/new` → view at `/projects/[id]`
- **Proposed**: Same flow, but StackBlitz replaces artifact view
- **Streaming Flow**: Navigate to project page → Initialize StackBlitz → Stream new generation or load existing artifacts

### 5. Error Handling

- **Streaming errors**: How to handle partial failures?
- **StackBlitz errors**: What if embedding fails?
- **Network issues**: Reconnection strategy needed?

## Implementation Phases

### Phase 1: Basic StackBlitz Integration ✅ FEASIBLE

- Install `@stackblitz/sdk`
- Replace `ArtifactsTab` with embedded StackBlitz using `embedProject()`
- Load existing artifacts into StackBlitz using `applyFsDiff()` on page load
- Remove preview functionality

### Phase 2: Streaming Architecture ✅ OPTIMAL SOLUTION

- Create API route `/api/stream-generate/[runId]` for LLM streaming
- Implement Server-Sent Events for real-time client updates
- Use OpenAI streaming (`stream: true`) for token-level streaming
- Save completed files to Convex using existing `api.artifacts.upsert`
- Keep existing Convex queries for project data and run history

### Phase 3: Real-time Code Streaming ✅ FEASIBLE

- Connect API route streaming to StackBlitz via `applyFsDiff`
- Implement chunk-by-chunk file updates as content streams
- Add streaming status UI and use `editor.setCurrentFile()` to focus on active file
- Use `editor.openFile()` to manage multiple files during generation
- Persist final artifacts to Convex for historical access and sharing

### Phase 4: Polish & Error Handling

- Robust error handling for streaming failures
- Loading states and reconnection logic
- Performance optimization

## Questions for Clarification

1. **Streaming granularity**: Chunk-by-chunk streaming is optimal (every few hundred characters or logical code blocks)
2. ~~**Convex dependency**: Are you open to bypassing Convex for real-time streaming if needed?~~ ✅ **SOLVED**: API routes for streaming, Convex for persistence - best of both worlds
3. ~~**Template selection**: Should StackBlitz always start with a specific template (React, Next.js, etc.) or dynamic based on generation?~~ ✅ **NO TEMPLATE NEEDED**: We provide all the code, so start with empty project
4. ~~**Backward compatibility**: Should old projects without streaming still work with the new StackBlitz view?~~ ✅ **NOT REQUIRED**: No need to support old projects
5. ~~**StackBlitz account**: Free SDK provides all needed functionality (`applyFsDiff`, editor control, preview)~~ ✅ **CONFIRMED**: Free tier sufficient

## Potential Blockers

1. ~~**StackBlitz limitations**: If SDK doesn't support partial file streaming~~ ✅ **SOLVED**: `applyFsDiff` enables real-time file updates
2. ~~**Convex streaming**: If Convex can't handle real-time updates efficiently~~ ✅ **SOLVED**: API routes handle streaming, Convex handles persistence optimally
3. ~~**CORS/Security**: StackBlitz embedding restrictions~~ ✅ **NOT A CONCERN**: Current solution works fine
4. **Performance**: Real-time updates might be too resource-intensive (mitigated by smart chunking and API route optimization)
5. **LLM integration**: Current agent architecture needs modification for streaming ✅ **STRATEGY DEFINED**: Move to API routes

## Success Criteria

- Embedded StackBlitz IDE replaces current code view ✅ **FEASIBLE**
- Code streams in real-time as LLM generates it ✅ **FEASIBLE** (via `applyFsDiff` + persistent streaming)
- Built-in preview eliminates need for separate preview route ✅ **BUILT-IN**
- Maintains project persistence and run history ✅ **ENHANCED** (persistent streaming improves this)
- Performance remains acceptable during streaming ✅ **OPTIMIZED** (smart batching reduces overhead)
