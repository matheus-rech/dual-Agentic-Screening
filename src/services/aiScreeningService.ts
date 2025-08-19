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
    projectId: string
  ): Promise<DualScreeningResult> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-screening', {
        body: {
          referenceId: reference.id,
          reference,
          criteria,
          projectId
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

  static async bulkScreenReferences(
    references: ScreeningReference[],
    criteria: ScreeningCriteria,
    projectId: string,
    onProgress?: (completed: number, total: number) => void
  ): Promise<DualScreeningResult[]> {
    const results: DualScreeningResult[] = [];
    
    for (let i = 0; i < references.length; i++) {
      try {
        const result = await this.screenReference(references[i], criteria, projectId);
        results.push(result);
        onProgress?.(i + 1, references.length);
        
        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error screening reference ${references[i].id}:`, error);
        results.push({
          success: false,
          referenceId: references[i].id,
          finalDecision: 'maybe',
          agreement: false,
          confidence: 0,
          reviewer1: { recommendation: 'maybe', confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' },
          reviewer2: { recommendation: 'maybe', confidence: 0, reasoning: 'Error occurred', reviewer: 'Error' }
        });
      }
    }

    return results;
  }

  static getAgreementRate(results: DualScreeningResult[]): number {
    const agreements = results.filter(r => r.agreement).length;
    return results.length > 0 ? agreements / results.length : 0;
  }

  static getConflictResults(results: DualScreeningResult[]): DualScreeningResult[] {
    return results.filter(r => !r.agreement);
  }
}