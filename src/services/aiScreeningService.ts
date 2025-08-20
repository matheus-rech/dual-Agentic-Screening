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
  timeframeStart?: string;
  timeframeEnd?: string;
  timeframeDescription?: string;
  inclusionCriteria?: string[];
  exclusionCriteria?: string[];
}

export interface AIReviewResult {
  recommendation: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reasoning: string;
  reviewer: string;
}

export interface DualScreeningResult {
  id: string;
  title: string;
  primaryReviewer: {
    decision: 'include' | 'exclude' | 'maybe';
    confidence: number;
    reasoning: string;
    reviewer: string;
  };
  secondaryReviewer: {
    decision: 'include' | 'exclude' | 'maybe';
    confidence: number;
    reasoning: string;
    reviewer: string;
  };
  finalDecision: 'include' | 'exclude' | 'maybe';
  agreement: boolean;
  conflictResolution?: string | null;
}

export class DualLLMScreener {
  static async screenReference(
    reference: ScreeningReference,
    criteria: ScreeningCriteria,
    projectId: string,
    sessionId?: string
  ): Promise<DualScreeningResult> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Screening reference ${reference.id}, attempt ${attempt}/${maxRetries}`);
        
        // Update progress if session ID provided
        if (sessionId) {
          await this.updateProgress(sessionId, reference, 'running');
        }

        // Call the AI screening edge function
        const { data, error } = await supabase.functions.invoke('ai-screening', {
          body: {
            referenceId: reference.id,
            reference: {
              title: reference.title || 'No title provided',
              abstract: reference.abstract || 'No abstract provided',
              authors: reference.authors || 'No authors provided',
              journal: reference.journal,
              year: reference.year,
              doi: reference.doi
            },
            criteria: {
              population: criteria.population,
              intervention: criteria.intervention,
              comparator: criteria.comparator,
              outcome: criteria.outcome,
              studyDesigns: criteria.studyDesigns,
              timeframeStart: criteria.timeframeStart,
              timeframeEnd: criteria.timeframeEnd,
              timeframeDescription: criteria.timeframeDescription,
              inclusionCriteria: criteria.inclusionCriteria,
              exclusionCriteria: criteria.exclusionCriteria
            },
            projectId
          }
        });

        if (error) {
          console.error(`AI screening function error (attempt ${attempt}):`, error);
          lastError = new Error(`AI screening failed: ${error.message}`);
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (!data) {
          lastError = new Error('No data returned from AI screening function');
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (!data.success) {
          lastError = new Error(`AI screening failed: ${data.error || 'Unknown error'}`);
          
          if (attempt === maxRetries) {
            throw lastError;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        // Validate the response structure
        if (!data.reviewer1 || !data.reviewer2) {
          throw new Error('Invalid response structure: missing reviewer data');
        }

        // Ensure all required fields are present with defaults
        const primaryReviewer = {
          decision: data.reviewer1.recommendation || 'maybe',
          confidence: typeof data.reviewer1.confidence === 'number' ? data.reviewer1.confidence : 0,
          reasoning: data.reviewer1.reasoning || 'No reasoning provided',
          reviewer: data.reviewer1.reviewer || 'Primary Reviewer'
        };

        const secondaryReviewer = {
          decision: data.reviewer2.recommendation || 'maybe',
          confidence: typeof data.reviewer2.confidence === 'number' ? data.reviewer2.confidence : 0,
          reasoning: data.reviewer2.reasoning || 'No reasoning provided',
          reviewer: data.reviewer2.reviewer || 'Secondary Reviewer'
        };

        return {
          id: reference.id,
          title: reference.title || 'Untitled Reference',
          primaryReviewer,
          secondaryReviewer,
          finalDecision: data.finalDecision || 'maybe',
          agreement: data.agreement || false,
          conflictResolution: data.agreement ? null : 'requires_manual_review'
        };

      } catch (error) {
        lastError = error as Error;
        console.error(`Error in screenReference attempt ${attempt}:`, error);
        
        if (attempt === maxRetries) {
          break; // Exit the retry loop
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    // If we reach here, all retries failed
    console.error('All screening attempts failed for reference:', reference.id, 'Last error:', lastError);
    
    // Return a fallback result instead of throwing
    return {
      id: reference.id,
      title: reference.title || 'Untitled Reference',
      primaryReviewer: {
        decision: 'maybe',
        confidence: 0,
        reasoning: `Error during screening: ${lastError?.message || 'Unknown error'}. Manual review required.`,
        reviewer: 'System (Error)'
      },
      secondaryReviewer: {
        decision: 'maybe',
        confidence: 0,
        reasoning: `Error during screening: ${lastError?.message || 'Unknown error'}. Manual review required.`,
        reviewer: 'System (Error)'
      },
      finalDecision: 'maybe',
      agreement: false,
      conflictResolution: 'error_occurred'
    };
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
        const avgConfidence = (result.primaryReviewer.confidence + result.secondaryReviewer.confidence) / 2;
        await this.addReasoningStep(sessionId, reference.id, 'System', 'Screening completed', `Final decision: ${result.finalDecision}`, avgConfidence);
        onReasoningStep?.({
          id: crypto.randomUUID(),
          reviewer: 'System',
          step: 'Screening completed',
          reasoning: `Final decision: ${result.finalDecision}`,
          confidence: avgConfidence,
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
          id: reference.id,
          title: reference.title || 'Untitled Reference',
          primaryReviewer: { decision: 'maybe' as const, confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' },
          secondaryReviewer: { decision: 'maybe' as const, confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' },
          finalDecision: 'maybe' as const,
          agreement: false,
          conflictResolution: 'error_occurred'
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