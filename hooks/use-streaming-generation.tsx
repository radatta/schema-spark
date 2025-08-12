import { useState, useEffect, useRef } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { useAuth } from '@clerk/nextjs';

export type StreamEvent = 
  | { type: 'status'; data: { phase: string; message: string } }
  | { type: 'plan_chunk'; data: { content: string; accumulated: string } }
  | { type: 'plan_complete'; data: { content: string } }
  | { type: 'file_chunk'; data: { filePath: string; content: string; accumulated: string } }
  | { type: 'file_complete'; data: { filePath: string; content: string } }
  | { type: 'complete'; data: { message: string } }
  | { type: 'error'; data: { message: string } };

export interface StreamingState {
  isStreaming: boolean;
  currentPhase: string;
  currentMessage: string;
  planContent: string;
  files: Record<string, string>;
  error: string | null;
  isComplete: boolean;
}

export function useStreamingGeneration(runId: Id<"runs"> | null) {
  const { getToken } = useAuth();
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    currentPhase: '',
    currentMessage: '',
    planContent: '',
    files: {},
    error: null,
    isComplete: false,
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  // Function to start streaming generation
  const startGeneration = async (projectId: Id<"projects">, inputSpec: string, model?: string) => {
    if (!runId) {
      setState(prev => ({ ...prev, error: 'No run ID provided' }));
      return;
    }

    try {
      // Get auth token
      const authToken = await getToken({ template: "convex" });
      if (!authToken) {
        setState(prev => ({ ...prev, error: 'Authentication required' }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        isStreaming: true, 
        error: null, 
        isComplete: false,
        currentPhase: 'starting',
        currentMessage: 'Initializing generation...',
        planContent: '',
        files: {}
      }));

      // Start the streaming API call
      const response = await fetch(`/api/stream-generate/${runId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          inputSpec,
          model: model || 'gpt-4-turbo',
          authToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Create EventSource-like interface for Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        let currentEventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          
          if (line.startsWith('data: ') && currentEventType) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent({ type: currentEventType as any, data });
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Streaming error:', error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Unknown error',
        isStreaming: false 
      }));
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'status':
        setState(prev => ({
          ...prev,
          currentPhase: event.data.phase,
          currentMessage: event.data.message
        }));
        break;

      case 'plan_chunk':
        setState(prev => ({
          ...prev,
          planContent: event.data.accumulated
        }));
        break;

      case 'plan_complete':
        setState(prev => ({
          ...prev,
          planContent: event.data.content
        }));
        break;

      case 'file_chunk':
        setState(prev => ({
          ...prev,
          files: {
            ...prev.files,
            [event.data.filePath]: event.data.accumulated
          }
        }));
        break;

      case 'file_complete':
        setState(prev => ({
          ...prev,
          files: {
            ...prev.files,
            [event.data.filePath]: event.data.content
          }
        }));
        break;

      case 'complete':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          isComplete: true,
          currentMessage: event.data.message
        }));
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          error: event.data.message,
          isStreaming: false
        }));
        break;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    ...state,
    startGeneration,
  };
}
