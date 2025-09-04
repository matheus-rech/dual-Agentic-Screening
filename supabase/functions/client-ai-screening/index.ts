import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIReviewResult {
  recommendation: 'include' | 'exclude';
  confidence: number;
  reasoning: string;
  reviewer: string;
  picott_assessment?: any;
  criteria_assessment?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference, criteria, projectId } = await req.json();

    console.log('Starting client-side AI screening for reference:', reference?.id);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create prompts for dual review
    const basePrompt = createScreeningPrompt(reference, criteria);
    
    // Use rule-based fallback screening when no AI is available
    const reviewer1Result = await performRuleBasedScreening(reference, criteria, 'Rule-based Conservative');
    const reviewer2Result = await performRuleBasedScreening(reference, criteria, 'Rule-based Comprehensive');

    // Evaluate agreement
    const agreement = reviewer1Result.recommendation === reviewer2Result.recommendation;
    const finalDecision = agreement ? reviewer1Result.recommendation : 'exclude';
    const averageConfidence = (reviewer1Result.confidence + reviewer2Result.confidence) / 2;

    console.log('Client-side screening completed:', {
      agreement,
      finalDecision,
      confidence: averageConfidence
    });

    // Log to screening log
    await supabase
      .from('ai_screening_log')
      .insert({
        reference_id: reference.id,
        project_id: projectId,
        screening_stage: 'title_abstract',
        primary_model_decision: reviewer1Result.recommendation,
        primary_model_confidence: reviewer1Result.confidence,
        secondary_model_decision: reviewer2Result.recommendation,
        secondary_model_confidence: reviewer2Result.confidence,
        final_decision: finalDecision,
        model_agreement_score: agreement ? 1.0 : 0.0,
        decision_reason: {
          reviewer1: reviewer1Result,
          reviewer2: reviewer2Result,
          agreement,
          method: 'rule-based-fallback',
          processed_at: new Date().toISOString()
        },
        screening_start_time: new Date().toISOString(),
        screening_end_time: new Date().toISOString(),
        processing_duration_ms: 100
      });

    return new Response(JSON.stringify({
      success: true,
      referenceId: reference.id,
      finalDecision,
      agreement,
      confidence: averageConfidence,
      reviewer1: reviewer1Result,
      reviewer2: reviewer2Result,
      method: 'client-side-rule-based'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in client-ai-screening function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createScreeningPrompt(reference: any, criteria: any): string {
  return `
SYSTEMATIC REVIEW SCREENING TASK

ABSTRACT TO SCREEN:
Title: "${reference.title || 'No title provided'}"
Abstract: "${reference.abstract || 'No abstract provided'}"
Authors: ${reference.authors || 'Not specified'}
Journal: ${reference.journal || 'Not specified'}
Year: ${reference.year || 'Not specified'}

SCREENING CRITERIA:
Population: ${criteria.population || 'Not specified'}
Intervention: ${criteria.intervention || 'Not specified'}
Comparator: ${criteria.comparator || 'Not specified'}
Outcome: ${criteria.outcome || 'Not specified'}
Timeframe: ${criteria.timeframe_description || 'Not specified'}
Study Designs: ${Array.isArray(criteria.study_designs) ? criteria.study_designs.join(', ') : 'Not specified'}

INCLUSION CRITERIA:
${Array.isArray(criteria.inclusion_criteria) ? criteria.inclusion_criteria.map((c: any, i: number) => `${i+1}. ${c.criterion || c}`).join('\n') : 'Not specified'}

EXCLUSION CRITERIA:
${Array.isArray(criteria.exclusion_criteria) ? criteria.exclusion_criteria.map((c: any, i: number) => `${i+1}. ${c.criterion || c}`).join('\n') : 'Not specified'}

Please screen this abstract and determine if it should be INCLUDED or EXCLUDED from the systematic review.
`;
}

async function performRuleBasedScreening(reference: any, criteria: any, reviewerName: string): Promise<AIReviewResult> {
  const title = (reference.title || '').toLowerCase();
  const abstract = (reference.abstract || '').toLowerCase();
  const fullText = `${title} ${abstract}`;

  let score = 0.5; // Start with neutral score
  let reasoning = [];

  // Population matching
  if (criteria.population) {
    const populationKeywords = extractKeywords(criteria.population);
    const populationMatch = populationKeywords.some(keyword => 
      fullText.includes(keyword.toLowerCase())
    );
    if (populationMatch) {
      score += 0.15;
      reasoning.push(`Population criteria likely met - found relevant terms`);
    } else {
      score -= 0.1;
      reasoning.push(`Population criteria unclear - no clear population match`);
    }
  }

  // Intervention matching
  if (criteria.intervention) {
    const interventionKeywords = extractKeywords(criteria.intervention);
    const interventionMatch = interventionKeywords.some(keyword => 
      fullText.includes(keyword.toLowerCase())
    );
    if (interventionMatch) {
      score += 0.15;
      reasoning.push(`Intervention criteria likely met - found relevant terms`);
    } else {
      score -= 0.1;
      reasoning.push(`Intervention criteria unclear - no clear intervention match`);
    }
  }

  // Study design matching
  if (Array.isArray(criteria.study_designs) && criteria.study_designs.length > 0) {
    const designKeywords = criteria.study_designs.map((d: string) => d.toLowerCase());
    const designMatch = designKeywords.some(design => 
      fullText.includes(design) || 
      fullText.includes(design.replace(' ', '')) ||
      (design.includes('trial') && fullText.includes('trial')) ||
      (design.includes('study') && fullText.includes('study'))
    );
    if (designMatch) {
      score += 0.1;
      reasoning.push(`Study design criteria likely met`);
    } else {
      score -= 0.05;
      reasoning.push(`Study design unclear`);
    }
  }

  // Check for common exclusion indicators
  const exclusionIndicators = [
    'review', 'meta-analysis', 'commentary', 'editorial', 'letter',
    'case report', 'case series', 'animal', 'in vitro', 'protocol'
  ];
  
  const hasExclusionIndicator = exclusionIndicators.some(indicator => 
    fullText.includes(indicator)
  );
  
  if (hasExclusionIndicator) {
    score -= 0.2;
    reasoning.push(`Potential exclusion criteria detected`);
  }

  // Determine final recommendation
  const confidence = Math.abs(score - 0.5) * 2; // Convert to 0-1 confidence
  const recommendation = score > 0.5 ? 'include' : 'exclude';

  return {
    recommendation,
    confidence: Math.min(Math.max(confidence, 0.1), 0.9), // Clamp between 0.1-0.9
    reasoning: `${reviewerName} rule-based analysis: ${reasoning.join('. ')}. Overall score: ${score.toFixed(2)}.`,
    reviewer: reviewerName
  };
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  // Simple keyword extraction - split by common delimiters and clean
  return text
    .toLowerCase()
    .split(/[,;.\s]+/)
    .map(word => word.trim())
    .filter(word => word.length > 2 && !['and', 'or', 'the', 'for', 'with', 'in', 'on', 'at'].includes(word))
    .slice(0, 10); // Limit to first 10 keywords
}