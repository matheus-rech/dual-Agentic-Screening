import { supabase } from "@/integrations/supabase/client";

export interface ScreeningReference {
  id: string;
  title: string;
  abstract: string;
  authors: string;
  journal?: string;
  year?: number;
  doi?: string;
}

export interface ScreeningCriteria {
  population?: string;
  intervention?: string;
  comparator?: string;
  outcome?: string;
  studyDesigns?: string[];
}

export interface AIReviewResult {
  recommendation: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reasoning: string;
  reviewer: string;
}

export interface DualScreeningResult {
  success: boolean;
  referenceId: string;
  finalDecision: 'include' | 'exclude' | 'maybe' | 'conflict';
  agreement: boolean;
  confidence: number;
  reviewer1: AIReviewResult;
  reviewer2: AIReviewResult;
}

export class DualLLMScreener {
  static async screenReference(
    reference: ScreeningReference,
    criteria: ScreeningCriteria,
    projectId: string,
    sessionId?: string
  ): Promise<DualScreeningResult> {
    try {
      // Update progress if session ID provided
      if (sessionId) {
        await this.updateProgress(sessionId, reference, 'running');
      }

      const { data, error } = await supabase.functions.invoke('ai-screening', {
        body: {
          referenceId: reference.id,
          reference,
          criteria,
          projectId,
          sessionId
        }
      });

      if (error) {
        throw new Error(`Screening failed: ${error.message}`);
      }

      return data as DualScreeningResult;
    } catch (error) {
      console.error('Error in dual LLM screening:', error);
      throw error;
    }
  }

  static async updateProgress(
    sessionId: string,
    currentReference?: ScreeningReference,
    status: 'running' | 'completed' | 'error' = 'running'
  ) {
    try {
      await supabase
        .from('screening_progress')
        .update({
          current_reference_id: currentReference?.id,
          current_reference_title: currentReference?.title,
          current_reference_authors: currentReference?.authors,
          status,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  }

  static async bulkScreenReferences(
    references: ScreeningReference[],
    criteria: ScreeningCriteria,
    projectId: string,
    onProgress?: (completed: number, total: number) => void,
    onCurrentReference?: (reference: ScreeningReference) => void,
    onReasoningStep?: (step: any) => void
  ): Promise<DualScreeningResult[]> {
    const results: DualScreeningResult[] = [];
    const sessionId = crypto.randomUUID();
    const startTime = Date.now();
    
    // Initialize progress tracking
    await this.initializeProgress(sessionId, projectId, references.length);
    
    for (let i = 0; i < references.length; i++) {
      const reference = references[i];
      
      try {
        // Update current reference
        onCurrentReference?.(reference);
        await this.updateProgress(sessionId, reference, 'running');
        
        // Add reasoning step
        await this.addReasoningStep(sessionId, reference.id, 'System', 'Starting AI screening', `Analyzing reference: ${reference.title}`, 1.0);
        onReasoningStep?.({
          id: crypto.randomUUID(),
          reviewer: 'System',
          step: 'Starting AI screening',
          reasoning: `Analyzing reference: ${reference.title}`,
          confidence: 1.0,
          timestamp: new Date()
        });
        
        const result = await this.screenReference(reference, criteria, projectId, sessionId);
        results.push(result);
        
        // Update progress counts
        await this.updateProgressCounts(sessionId, result);
        
        // Add completion reasoning step
        await this.addReasoningStep(sessionId, reference.id, 'System', 'Screening completed', `Final decision: ${result.finalDecision}`, result.confidence);
        onReasoningStep?.({
          id: crypto.randomUUID(),
          reviewer: 'System',
          step: 'Screening completed',
          reasoning: `Final decision: ${result.finalDecision}`,
          confidence: result.confidence,
          timestamp: new Date()
        });
        
        // Calculate progress and estimated time
        const completed = i + 1;
        const progress = (completed / references.length) * 100;
        const elapsedTime = Date.now() - startTime;
        const estimatedTimeRemaining = completed > 0 ? Math.round((elapsedTime / completed) * (references.length - completed) / 1000) : null;
        
        // Update progress with time estimate
        await supabase
          .from('screening_progress')
          .update({
            current_reference_index: completed,
            estimated_time_remaining: estimatedTimeRemaining
          })
          .eq('session_id', sessionId);
        
        onProgress?.(completed, references.length);
        
        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error screening reference ${reference.id}:`, error);
        
        const errorResult = {
          success: false,
          referenceId: reference.id,
          finalDecision: 'maybe' as const,
          agreement: false,
          confidence: 0,
          reviewer1: { recommendation: 'maybe' as const, confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' },
          reviewer2: { recommendation: 'maybe' as const, confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' }
        };
        
        results.push(errorResult);
        
        // Add error reasoning step
        await this.addReasoningStep(sessionId, reference.id, 'System', 'Error occurred', `Error: ${error.message}`, 0);
        onReasoningStep?.({
          id: crypto.randomUUID(),
          reviewer: 'System',
          step: 'Error occurred',
          reasoning: `Error: ${error.message}`,
          confidence: 0,
          timestamp: new Date()
        });
        
        await this.updateProgressCounts(sessionId, errorResult);
        onProgress?.(i + 1, references.length);
      }
    }

    // Mark as completed
    await supabase
      .from('screening_progress')
      .update({ status: 'completed' })
      .eq('session_id', sessionId);

    return results;
  }

  static async initializeProgress(sessionId: string, projectId: string, totalReferences: number) {
    try {
      await supabase
        .from('screening_progress')
        .insert({
          session_id: sessionId,
          project_id: projectId,
          total_references: totalReferences,
          current_reference_index: 0,
          completed_count: 0,
          included_count: 0,
          excluded_count: 0,
          conflict_count: 0,
          status: 'running'
        });
    } catch (error) {
      console.error('Error initializing progress:', error);
    }
  }

  static async updateProgressCounts(sessionId: string, result: DualScreeningResult) {
    try {
      const { data: currentProgress } = await supabase
        .from('screening_progress')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (currentProgress) {
        const updates = {
          completed_count: currentProgress.completed_count + 1,
          included_count: result.finalDecision === 'include' ? currentProgress.included_count + 1 : currentProgress.included_count,
          excluded_count: result.finalDecision === 'exclude' ? currentProgress.excluded_count + 1 : currentProgress.excluded_count,
          conflict_count: !result.agreement ? currentProgress.conflict_count + 1 : currentProgress.conflict_count
        };

        await supabase
          .from('screening_progress')
          .update(updates)
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('Error updating progress counts:', error);
    }
  }

  static async addReasoningStep(
    sessionId: string,
    referenceId: string,
    reviewer: string,
    stepDescription: string,
    reasoning: string,
    confidence?: number
  ) {
    try {
      await supabase
        .from('screening_reasoning_steps')
        .insert({
          session_id: sessionId,
          reference_id: referenceId,
          reviewer,
          step_description: stepDescription,
          reasoning,
          confidence
        });
    } catch (error) {
      console.error('Error adding reasoning step:', error);
    }
  }

  static getAgreementRate(results: DualScreeningResult[]): number {
    const agreements = results.filter(r => r.agreement).length;
    return results.length > 0 ? agreements / results.length : 0;
  }

  static getConflictResults(results: DualScreeningResult[]): DualScreeningResult[] {
    return results.filter(r => !r.agreement);
  }
}