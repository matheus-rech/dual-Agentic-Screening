import { useState, useCallback, useRef } from 'react';
import { DualLLMScreener, ScreeningReference, ScreeningCriteria, DualScreeningResult } from '@/services/aiScreeningService';
import { supabase } from '@/integrations/supabase/client';

export interface ProgressStats {
  current: number;
  total: number;
  percentage: number;
  included: number;
  excluded: number;
  conflicts: number;
  estimatedTimeRemaining?: string;
}

export interface CurrentReference {
  id: string;
  title: string;
  authors: string;
}

export interface ReasoningStep {
  id: string;
  reviewer: string;
  step: string;
  reasoning: string;
  confidence?: number;
  timestamp: Date;
}

export interface ScreeningProgress {
  sessionId: string;
  stats: ProgressStats;
  currentReference?: CurrentReference;
  reasoningSteps: ReasoningStep[];
  isComplete: boolean;
}

export const useEnhancedScreening = () => {
  const [isScreening, setIsScreening] = useState(false);
  const [progress, setProgress] = useState<ScreeningProgress>({
    sessionId: '',
    stats: { current: 0, total: 0, percentage: 0, included: 0, excluded: 0, conflicts: 0 },
    reasoningSteps: [],
    isComplete: false
  });
  const [results, setResults] = useState<DualScreeningResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const progressPollingRef = useRef<NodeJS.Timeout>();
  const reasoningPollingRef = useRef<NodeJS.Timeout>();

  const startScreening = useCallback(async (
    references: ScreeningReference[],
    criteria: ScreeningCriteria,
    projectId: string
  ) => {
    setIsScreening(true);
    setError(null);
    setResults([]);
    
    const sessionId = crypto.randomUUID();
    setProgress(prev => ({ ...prev, sessionId }));

    try {
      // Start polling for progress updates
      startProgressPolling(sessionId);
      startReasoningPolling(sessionId);

      const screeningResults = await DualLLMScreener.bulkScreenReferences(
        references,
        criteria,
        projectId,
        (completed, total) => {
          // This callback is less important now since we poll for updates
          console.log(`Progress: ${completed}/${total}`);
        },
        (currentRef) => {
          setProgress(prev => ({
            ...prev,
            currentReference: {
              id: currentRef.id,
              title: currentRef.title,
              authors: currentRef.authors
            }
          }));
        },
        (step) => {
          setProgress(prev => ({
            ...prev,
            reasoningSteps: [...prev.reasoningSteps, step]
          }));
        }
      );

      setResults(screeningResults);
      setProgress(prev => ({ ...prev, isComplete: true }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsScreening(false);
      stopPolling();
    }
  }, []);

  const startProgressPolling = useCallback((sessionId: string) => {
    const pollProgress = async () => {
      try {
        const { data } = await supabase
          .from('screening_progress')
          .select('*')
          .eq('session_id', sessionId)
          .single();

        if (data) {
          const stats: ProgressStats = {
            current: data.completed_count,
            total: data.total_references,
            percentage: data.total_references > 0 ? (data.completed_count / data.total_references) * 100 : 0,
            included: data.included_count,
            excluded: data.excluded_count,
            conflicts: data.conflict_count,
            estimatedTimeRemaining: data.estimated_time_remaining ? `${Math.floor(data.estimated_time_remaining / 60)}m ${data.estimated_time_remaining % 60}s` : undefined
          };

          const currentReference = data.current_reference_id ? {
            id: data.current_reference_id,
            title: data.current_reference_title || 'Unknown Title',
            authors: data.current_reference_authors || 'Unknown Authors'
          } : undefined;

          setProgress(prev => ({
            ...prev,
            stats,
            currentReference,
            isComplete: data.status === 'completed'
          }));

          if (data.status === 'completed') {
            stopPolling();
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    };

    // Poll every 500ms for real-time feel
    progressPollingRef.current = setInterval(pollProgress, 500);
    pollProgress(); // Initial poll
  }, []);

  const startReasoningPolling = useCallback((sessionId: string) => {
    const pollReasoning = async () => {
      try {
        const { data } = await supabase
          .from('screening_reasoning_steps')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (data) {
          const steps: ReasoningStep[] = data.map(step => ({
            id: step.id,
            reviewer: step.reviewer,
            step: step.step_description,
            reasoning: step.reasoning,
            confidence: step.confidence,
            timestamp: new Date(step.created_at)
          }));

          setProgress(prev => ({
            ...prev,
            reasoningSteps: steps
          }));
        }
      } catch (error) {
        console.error('Error polling reasoning steps:', error);
      }
    };

    // Poll every 1 second for reasoning steps
    reasoningPollingRef.current = setInterval(pollReasoning, 1000);
    pollReasoning(); // Initial poll
  }, []);

  const stopPolling = useCallback(() => {
    if (progressPollingRef.current) {
      clearInterval(progressPollingRef.current);
    }
    if (reasoningPollingRef.current) {
      clearInterval(reasoningPollingRef.current);
    }
  }, []);

  const resetScreening = useCallback(() => {
    setIsScreening(false);
    setProgress({
      sessionId: '',
      stats: { current: 0, total: 0, percentage: 0, included: 0, excluded: 0, conflicts: 0 },
      reasoningSteps: [], // Keep reasoning steps for review even after completion
      isComplete: false
    });
    setResults([]);
    setError(null);
    stopPolling();
  }, [stopPolling]);

  const clearReasoningHistory = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      reasoningSteps: []
    }));
  }, []);

  return {
    isScreening,
    progress,
    results,
    error,
    startScreening,
    resetScreening,
    clearReasoningHistory
  };
};