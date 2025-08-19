import { ScreeningReference, ScreeningCriteria } from './aiScreeningService';

export interface ReasoningStep {
  id: string;
  reviewer: string;
  step: string;
  reasoning: string;
  confidence?: number;
  timestamp: Date;
}

export interface CurrentReference {
  id: string;
  title: string;
  authors: string;
}

export interface ProgressUpdate {
  current: number;
  total: number;
  percentage: number;
  currentReference: CurrentReference;
}

export interface StreamingCallbacks {
  onProgress?: (progress: ProgressUpdate) => void;
  onReasoningStep?: (step: ReasoningStep) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export class StreamingDualLLMScreener {
  private ws: WebSocket | null = null;
  private callbacks: StreamingCallbacks = {};

  async startStreaming(
    references: ScreeningReference[],
    criteria: ScreeningCriteria,
    projectId: string,
    callbacks: StreamingCallbacks
  ): Promise<void> {
    this.callbacks = callbacks;
    
    try {
      // Connect to the streaming edge function via WebSocket
      const wsUrl = `wss://jloyjcanvtolhgodeupf.functions.supabase.co/ai-screening-stream`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected, starting screening...');
        // Send the screening request
        this.ws?.send(JSON.stringify({
          type: 'start_screening',
          references,
          criteria,
          projectId
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received WebSocket message:', message);
          
          switch (message.type) {
            case 'connected':
              console.log('WebSocket connection confirmed');
              break;
              
            case 'progress':
              this.callbacks.onProgress?.(message);
              break;
              
            case 'reasoning_step':
              this.callbacks.onReasoningStep?.(message.step);
              break;
              
            case 'complete':
              console.log('Screening completed');
              this.callbacks.onComplete?.();
              this.disconnect();
              break;
              
            case 'error':
              console.error('Screening error:', message.message);
              this.callbacks.onError?.(message.message);
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          this.callbacks.onError?.('Failed to parse server response');
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.callbacks.onError?.('Connection error occurred');
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        if (event.code !== 1000) { // Not a normal closure
          this.callbacks.onError?.('Connection lost unexpectedly');
        }
      };

    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      this.callbacks.onError?.('Failed to establish connection');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}