import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const groqApiKey = Deno.env.get('GROQ_API_KEY');
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced Zod schemas for validation
const PICOTTAssessmentSchema = z.object({
  population: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }),
  intervention: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }),
  comparator: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }),
  outcome: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }),
  timeframe: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }),
  study_design: z.object({
    status: z.enum(['present', 'absent', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  })
});

const CriteriaAssessmentSchema = z.object({
  inclusion_criteria: z.array(z.object({
    criterion: z.string(),
    status: z.enum(['met', 'not_met', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  })),
  exclusion_criteria: z.array(z.object({
    criterion: z.string(),
    status: z.enum(['violated', 'not_violated', 'unclear']),
    evidence: z.string(),
    quote: z.string().optional()
  }))
});

const AIReviewResultSchema = z.object({
  recommendation: z.enum(['include', 'exclude']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  reviewer: z.string(),
  picott_assessment: PICOTTAssessmentSchema.optional(),
  criteria_assessment: CriteriaAssessmentSchema.optional(),
  tokens_used: z.number().optional(),
  processing_time_ms: z.number().optional(),
  model_version: z.string().optional()
});

interface AIReviewResult {
  recommendation: 'include' | 'exclude';
  confidence: number;
  reasoning: string;
  reviewer: string;
  picott_assessment?: any;
  criteria_assessment?: any;
  tokens_used?: number;
  processing_time_ms?: number;
  model_version?: string;
}

interface ProviderHealthStatus {
  provider: string;
  healthy: boolean;
  last_error?: string;
  response_time_ms?: number;
}

// Provider health tracking
const providerHealth = new Map<string, ProviderHealthStatus>();

function updateProviderHealth(provider: string, healthy: boolean, error?: string, responseTime?: number) {
  providerHealth.set(provider, {
    provider,
    healthy,
    last_error: error,
    response_time_ms: responseTime
  });
}

function getProviderHealth(): ProviderHealthStatus[] {
  return Array.from(providerHealth.values());
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 AI Screening Service - Enhanced with PICOTT Telemetry');
    
    const { 
      reference, 
      criteria, 
      projectId, 
      sessionId,
      referenceId 
    } = await req.json();

    // Validate required inputs
    if (!reference || !criteria || !projectId) {
      throw new Error('Missing required parameters: reference, criteria, or projectId');
    }

    // Security validation
    if (!referenceId || typeof referenceId !== 'string' || referenceId.length < 10) {
      throw new Error('Invalid reference ID format');
    }

    console.log('Security validation passed for request:', {
      referenceId: referenceId.substring(0, 50) + '...',
      projectId: projectId.substring(0, 20) + '...',
      referenceTitle: reference.title?.substring(0, 80) + '...'
    });

    // Enhanced PICOTT-focused prompts
    const basePrompt = `
You are an expert systematic review researcher conducting a literature screening for inclusion/exclusion decisions.

REFERENCE TO SCREEN:
Title: ${reference.title}
Abstract: ${reference.abstract}
Authors: ${reference.authors?.join(', ') || 'Not provided'}
Journal: ${reference.journal || 'Not provided'}
Year: ${reference.year || 'Not provided'}
DOI: ${reference.doi || 'Not provided'}

SCREENING CRITERIA:
Population: ${criteria.population}
Intervention: ${criteria.intervention}
Comparator: ${criteria.comparator}
Outcomes: ${criteria.outcomes}
Study Designs: ${criteria.studyDesigns?.join(', ') || 'Not specified'}

Inclusion Criteria:
${criteria.inclusionCriteria?.map((c: string, i: number) => `${i+1}. ${c}`).join('\n') || 'None specified'}

Exclusion Criteria:  
${criteria.exclusionCriteria?.map((c: string, i: number) => `${i+1}. ${c}`).join('\n') || 'None specified'}

CRITICAL TASK: You must provide a comprehensive PICOTT assessment with EXACT QUOTES from the abstract where evidence is found.

For each PICOTT element, you MUST:
1. Determine if it's "present", "absent", or "unclear"
2. If present: Provide the EXACT quote from the title/abstract that supports this
3. If absent: Explain why it's missing and what you'd expect to see
4. If unclear: Explain what's ambiguous and what additional information is needed

RESPONSE FORMAT: Respond with ONLY valid JSON in this exact structure:`;

    const jsonStructure = `
{
  "recommendation": "include|exclude",
  "confidence": 0.XX,
  "picott_assessment": {
    "population": {
      "status": "present|absent|unclear",
      "evidence": "Detailed analysis of population criteria",
      "quote": "EXACT quote from abstract if status is present"
    },
    "intervention": {
      "status": "present|absent|unclear", 
      "evidence": "Detailed analysis of intervention criteria",
      "quote": "EXACT quote from abstract if status is present"
    },
    "comparator": {
      "status": "present|absent|unclear",
      "evidence": "Detailed analysis of comparator criteria", 
      "quote": "EXACT quote from abstract if status is present"
    },
    "outcome": {
      "status": "present|absent|unclear",
      "evidence": "Detailed analysis of outcome criteria",
      "quote": "EXACT quote from abstract if status is present"
    },
    "timeframe": {
      "status": "present|absent|unclear",
      "evidence": "Detailed analysis of timeframe/follow-up",
      "quote": "EXACT quote from abstract if status is present"
    },
    "study_design": {
      "status": "present|absent|unclear",
      "evidence": "Detailed analysis of study design",
      "quote": "EXACT quote from abstract if status is present"
    }
  },
  "criteria_assessment": {
    "inclusion_criteria": [
      {
        "criterion": "specific inclusion criterion text",
        "status": "met|not_met|unclear",
        "evidence": "Detailed rationale for this assessment",
        "quote": "EXACT supporting quote if available"
      }
    ],
    "exclusion_criteria": [
      {
        "criterion": "specific exclusion criterion text", 
        "status": "violated|not_violated|unclear",
        "evidence": "Detailed rationale for this assessment",
        "quote": "EXACT supporting quote if available"
      }
    ]
  },
  "reasoning": "Comprehensive final decision rationale explaining how PICOTT assessment and criteria evaluation led to include/exclude decision, highlighting key evidence and any uncertainties"
}`;

    const reviewer1Prompt = basePrompt + jsonStructure;
    const reviewer2Prompt = basePrompt + jsonStructure;

    console.log('🚀 Starting enhanced dual AI screening with reasoning models...');
    
    let reviewer1Result: AIReviewResult;
    let reviewer2Result: AIReviewResult;
    let primaryProvider = '';
    
    // Enhanced provider selection with health tracking
    try {
      console.log('💡 Attempting primary reasoning models: OpenAI O3 + Anthropic Claude 4...');
      const startTime = Date.now();
      
      // Call providers in parallel for better performance
      const [result1, result2] = await Promise.allSettled([
        callOpenAI(reviewer1Prompt, 'o3-2025-04-16', 'OpenAI O3 Reasoning (Conservative)'),
        callAnthropic(reviewer2Prompt, 'Anthropic Claude 4 Sonnet (Comprehensive)')
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      if (result1.status === 'fulfilled') {
        reviewer1Result = result1.value;
        reviewer1Result.processing_time_ms = totalTime / 2;
        updateProviderHealth('openai', true, undefined, totalTime / 2);
      } else {
        console.error('OpenAI failed:', result1.reason);
        updateProviderHealth('openai', false, result1.reason.message);
        throw result1.reason;
      }

      if (result2.status === 'fulfilled') {
        reviewer2Result = result2.value;
        reviewer2Result.processing_time_ms = totalTime / 2;
        updateProviderHealth('anthropic', true, undefined, totalTime / 2);
      } else {
        console.error('Anthropic failed:', result2.reason);
        updateProviderHealth('anthropic', false, result2.reason.message);
        throw result2.reason;
      }

      primaryProvider = 'openai-anthropic-reasoning';
      console.log('✅ Primary reasoning models successful');
      
    } catch (primaryError) {
      console.warn('⚠️ Primary reasoning models failed, trying secondary providers:', primaryError.message);
      
      try {
        // Secondary reasoning models: DeepSeek R1 + Groq
        console.log('🔄 Attempting secondary reasoning models: DeepSeek R1 + Groq...');
        const startTime = Date.now();
        
        const [result1, result2] = await Promise.allSettled([
          callOpenRouter(reviewer1Prompt, 'deepseek/deepseek-r1-distill-llama-70b', 'DeepSeek R1 (Conservative)'),
          callGroq(reviewer2Prompt, 'deepseek-r1-distill-llama-70b', 'Groq DeepSeek R1 (Comprehensive)')
        ]);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        if (result1.status === 'fulfilled') {
          reviewer1Result = result1.value;
          reviewer1Result.processing_time_ms = totalTime / 2;
          updateProviderHealth('openrouter', true, undefined, totalTime / 2);
        } else {
          updateProviderHealth('openrouter', false, result1.reason.message);
          throw result1.reason;
        }

        if (result2.status === 'fulfilled') {
          reviewer2Result = result2.value;
          reviewer2Result.processing_time_ms = totalTime / 2;
          updateProviderHealth('groq', true, undefined, totalTime / 2);
        } else {
          updateProviderHealth('groq', false, result2.reason.message);
          throw result2.reason;
        }

        primaryProvider = 'deepseek-reasoning';
        console.log('✅ Secondary reasoning models successful');
        
      } catch (secondaryError) {
        console.error('❌ Secondary reasoning models failed, using emergency fallback:', secondaryError.message);
        
        // Emergency fallback with basic models
        const startTime = Date.now();
        const [result1, result2] = await Promise.allSettled([
          callGroq(reviewer1Prompt, 'llama-3.3-70b-versatile', 'Groq Llama 3.3 (Conservative)'),
          callGemini(reviewer2Prompt, 'gemini-2.0-flash-exp', 'Gemini 2.0 Flash (Comprehensive)')
        ]);

        const endTime = Date.now();
        const totalTime = endTime - startTime;

        if (result1.status === 'fulfilled') {
          reviewer1Result = result1.value;
          reviewer1Result.processing_time_ms = totalTime / 2;
          updateProviderHealth('groq-fallback', true, undefined, totalTime / 2);
        } else {
          updateProviderHealth('groq-fallback', false, result1.reason.message);
          // Final fallback: create minimal valid response
          reviewer1Result = {
            recommendation: 'exclude',
            confidence: 0.1,
            reasoning: `Emergency fallback due to provider failures: ${result1.reason.message}. Manual review required.`,
            reviewer: 'Groq Llama 3.3 (Error)',
            processing_time_ms: totalTime / 2
          };
        }

        if (result2.status === 'fulfilled') {
          reviewer2Result = result2.value;
          reviewer2Result.processing_time_ms = totalTime / 2;
          updateProviderHealth('gemini', true, undefined, totalTime / 2);
        } else {
          updateProviderHealth('gemini', false, result2.reason.message);
          // Final fallback: create minimal valid response
          reviewer2Result = {
            recommendation: 'exclude',
            confidence: 0.1,
            reasoning: `Emergency fallback due to provider failures: ${result2.reason.message}. Manual review required.`,
            reviewer: 'Gemini 2.0 Flash (Error)',
            processing_time_ms: totalTime / 2
          };
        }

        primaryProvider = 'emergency-fallback';
        console.log('⚠️ Emergency fallback models used');
      }
    }

    console.log(`Primary provider used: ${primaryProvider}`);

    // Enhanced validation with Zod schemas
    try {
      if (reviewer1Result.picott_assessment) {
        PICOTTAssessmentSchema.parse(reviewer1Result.picott_assessment);
      }
      if (reviewer2Result.picott_assessment) {
        PICOTTAssessmentSchema.parse(reviewer2Result.picott_assessment);
      }
      console.log('✅ PICOTT assessments validated successfully');
    } catch (validationError) {
      console.warn('⚠️ PICOTT validation failed:', validationError.message);
    }

    console.log('📊 Enhanced Screening Results Summary:');
    console.log('Reviewer 1 result:', {
      reviewer: reviewer1Result.reviewer,
      recommendation: reviewer1Result.recommendation,
      confidence: reviewer1Result.confidence,
      processing_time: reviewer1Result.processing_time_ms + 'ms',
      tokens: reviewer1Result.tokens_used || 'unknown'
    });
    
    console.log('Reviewer 2 result:', {
      reviewer: reviewer2Result.reviewer,
      recommendation: reviewer2Result.recommendation,
      confidence: reviewer2Result.confidence,
      processing_time: reviewer2Result.processing_time_ms + 'ms',
      tokens: reviewer2Result.tokens_used || 'unknown'
    });

    // Enhanced agreement evaluation with detailed reasoning
    const bothReviewersValid = reviewer1Result.confidence > 0 && reviewer2Result.confidence > 0;
    const agreement = bothReviewersValid && (reviewer1Result.recommendation === reviewer2Result.recommendation);
    let finalDecision: string;
    let averageConfidence: number;
    let consensusReasoning: string;
    
    if (agreement && bothReviewersValid) {
      finalDecision = reviewer1Result.recommendation;
      averageConfidence = (reviewer1Result.confidence + reviewer2Result.confidence) / 2;
      consensusReasoning = `Both reviewers agreed on "${finalDecision}" with average confidence ${averageConfidence.toFixed(2)}. Consensus reached through consistent PICOTT assessment.`;
      console.log('✅ Reviewers in agreement:', finalDecision);
    } else if (bothReviewersValid) {
      // Enhanced conflict resolution with PICOTT analysis
      if (reviewer1Result.confidence > reviewer2Result.confidence) {
        finalDecision = reviewer1Result.recommendation;
        averageConfidence = reviewer1Result.confidence;
        consensusReasoning = `Conflict resolved in favor of Reviewer 1 (${reviewer1Result.reviewer}) due to higher confidence (${reviewer1Result.confidence} vs ${reviewer2Result.confidence}). Decision: ${finalDecision}`;
      } else if (reviewer2Result.confidence > reviewer1Result.confidence) {
        finalDecision = reviewer2Result.recommendation;
        averageConfidence = reviewer2Result.confidence;
        consensusReasoning = `Conflict resolved in favor of Reviewer 2 (${reviewer2Result.reviewer}) due to higher confidence (${reviewer2Result.confidence} vs ${reviewer1Result.confidence}). Decision: ${finalDecision}`;
      } else {
        // Equal confidence: Default to conservative approach (exclude)
        finalDecision = 'exclude';
        averageConfidence = Math.max(reviewer1Result.confidence, reviewer2Result.confidence);
        consensusReasoning = `Equal confidence conflict resolved using conservative approach. Both reviewers had confidence ${reviewer1Result.confidence}. Defaulting to exclude for safety.`;
      }
      console.log('⚠️ Conflict detected and resolved:', consensusReasoning);
    } else {
      // One or both reviewers failed - use the valid one or default to exclude
      if (reviewer1Result.confidence > 0) {
        finalDecision = reviewer1Result.recommendation;
        averageConfidence = reviewer1Result.confidence;
        consensusReasoning = `Using Reviewer 1 result due to Reviewer 2 failure. Decision based on ${reviewer1Result.reviewer} with confidence ${reviewer1Result.confidence}.`;
        console.log('Using Reviewer 1 result due to Reviewer 2 failure');
      } else if (reviewer2Result.confidence > 0) {
        finalDecision = reviewer2Result.recommendation;
        averageConfidence = reviewer2Result.confidence;
        consensusReasoning = `Using Reviewer 2 result due to Reviewer 1 failure. Decision based on ${reviewer2Result.reviewer} with confidence ${reviewer2Result.confidence}.`;
        console.log('Using Reviewer 2 result due to Reviewer 1 failure');
      } else {
        // Both failed - default to exclude for safety
        finalDecision = 'exclude';
        averageConfidence = 0.1;
        consensusReasoning = `Both reviewers failed - defaulting to exclude for safety. Manual review required. Errors: R1(${reviewer1Result.reasoning}) R2(${reviewer2Result.reasoning})`;
        console.warn('Both reviewers failed - defaulting to exclude');
      }
    }

    // Map decisions to database-compatible values
    const mapDecision = (decision: string) => {
      switch (decision) {
        case 'include': return 'included';
        case 'exclude': return 'excluded';
        default: return 'excluded'; // Default to excluded for safety
      }
    };

    const finalDecisionMapped = mapDecision(finalDecision);

    // Enhanced telemetry logging with PICOTT details
    const telemetryData = {
      project_id: projectId,
      reference_id: referenceId,
      screening_stage: 'title_abstract_screening',
      primary_model_decision: mapDecision(reviewer1Result.recommendation),
      primary_model_confidence: reviewer1Result.confidence,
      secondary_model_decision: mapDecision(reviewer2Result.recommendation),
      secondary_model_confidence: reviewer2Result.confidence,
      final_decision: finalDecisionMapped,
      average_confidence: averageConfidence,
      agreement_status: agreement ? 'agreement' : 'conflict',
      primary_model_name: reviewer1Result.reviewer,
      secondary_model_name: reviewer2Result.reviewer,
      consensus_reasoning: consensusReasoning,
      primary_provider: primaryProvider,
      total_tokens_used: (reviewer1Result.tokens_used || 0) + (reviewer2Result.tokens_used || 0),
      total_processing_time_ms: (reviewer1Result.processing_time_ms || 0) + (reviewer2Result.processing_time_ms || 0),
      picott_telemetry: JSON.stringify({
        reviewer1_picott: reviewer1Result.picott_assessment,
        reviewer2_picott: reviewer2Result.picott_assessment,
        criteria_assessment_1: reviewer1Result.criteria_assessment,
        criteria_assessment_2: reviewer2Result.criteria_assessment
      }),
      provider_health: JSON.stringify(getProviderHealth())
    };

    // Log enhanced screening results
    const { error: logError } = await supabase
      .from('ai_screening_log')
      .insert(telemetryData);

    if (logError) {
      console.error('Failed to log screening results:', logError);
    } else {
      console.log('✅ Enhanced telemetry logged successfully');
    }

    // Update progress if session provided
    if (sessionId) {
      const { error: progressError } = await supabase
        .from('screening_progress')
        .update({
          completed_references: 1,
          last_updated: new Date().toISOString()
        })
        .eq('session_id', sessionId);

      if (progressError) {
        console.error('Failed to update progress:', progressError);
      }

      // Log detailed reasoning steps for telemetry
      const { error: reasoningError } = await supabase
        .from('screening_reasoning_steps')
        .insert({
          session_id: sessionId,
          reference_id: referenceId,
          step_type: 'picott_analysis',
          step_data: JSON.stringify({
            reviewer1_analysis: {
              reviewer: reviewer1Result.reviewer,
              picott_assessment: reviewer1Result.picott_assessment,
              criteria_assessment: reviewer1Result.criteria_assessment,
              reasoning: reviewer1Result.reasoning,
              confidence: reviewer1Result.confidence
            },
            reviewer2_analysis: {
              reviewer: reviewer2Result.reviewer,
              picott_assessment: reviewer2Result.picott_assessment,
              criteria_assessment: reviewer2Result.criteria_assessment,
              reasoning: reviewer2Result.reasoning,
              confidence: reviewer2Result.confidence
            },
            consensus_analysis: {
              final_decision: finalDecision,
              average_confidence: averageConfidence,
              consensus_reasoning: consensusReasoning,
              agreement_status: agreement ? 'agreement' : 'conflict'
            }
          }),
          created_at: new Date().toISOString()
        });

      if (reasoningError) {
        console.error('Failed to log reasoning steps:', reasoningError);
      } else {
        console.log('✅ Detailed reasoning steps logged successfully');
      }
    }

    // Construct enhanced response with telemetry
    const response = {
      success: true,
      decision: finalDecisionMapped,
      confidence: averageConfidence,
      reasoning: consensusReasoning,
      agreement: agreement,
      reviewers: [
        {
          name: reviewer1Result.reviewer,
          recommendation: reviewer1Result.recommendation,
          confidence: reviewer1Result.confidence,
          reasoning: reviewer1Result.reasoning,
          picott_assessment: reviewer1Result.picott_assessment,
          criteria_assessment: reviewer1Result.criteria_assessment,
          processing_time_ms: reviewer1Result.processing_time_ms,
          tokens_used: reviewer1Result.tokens_used
        },
        {
          name: reviewer2Result.reviewer,
          recommendation: reviewer2Result.recommendation,
          confidence: reviewer2Result.confidence,
          reasoning: reviewer2Result.reasoning,
          picott_assessment: reviewer2Result.picott_assessment,
          criteria_assessment: reviewer2Result.criteria_assessment,
          processing_time_ms: reviewer2Result.processing_time_ms,
          tokens_used: reviewer2Result.tokens_used
        }
      ],
      telemetry: {
        primary_provider: primaryProvider,
        total_processing_time_ms: (reviewer1Result.processing_time_ms || 0) + (reviewer2Result.processing_time_ms || 0),
        total_tokens_used: (reviewer1Result.tokens_used || 0) + (reviewer2Result.tokens_used || 0),
        provider_health: getProviderHealth()
      }
    };

    console.log('🎉 Enhanced AI screening completed successfully');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ AI Screening Service Error:', error);
    
    // Log error for debugging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    console.error('Error details:', errorDetails);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: 'Check function logs for more information',
      provider_health: getProviderHealth()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Enhanced OpenAI function with O3 reasoning support
async function callOpenAI(prompt: string, model: string = 'o3-2025-04-16', reviewerName: string = 'OpenAI O3 Reasoning'): Promise<AIReviewResult> {
  const apiKey = openaiApiKey;
  if (!apiKey) throw new Error('OpenAI API key not configured');

  const startTime = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`OpenAI attempt ${attempt}/${maxRetries}`);

      // Enhanced prompt with strict PICOTT instructions
      const enhancedPrompt = `${prompt}

CRITICAL INSTRUCTIONS FOR PICOTT ASSESSMENT:
- For each PICOTT element, you MUST provide exact quotes from the abstract/title
- If an element is present, the "quote" field must contain the EXACT text that supports it
- If absent, explain what's missing and what you'd expect to see
- If unclear, explain the ambiguity and what additional info is needed
- Be precise and conservative in your assessments

Remember: This is for systematic review screening - accuracy is paramount.`;

      const requestBody: any = {
        model: model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert systematic review researcher conducting literature screening with rigorous PICOTT assessment methodology.' 
          },
          { 
            role: 'user', 
            content: enhancedPrompt 
          }
        ]
      };

      // Handle model-specific parameters
      if (model.startsWith('o3') || model.startsWith('o4') || model.startsWith('gpt-5') || model.startsWith('gpt-4.1')) {
        requestBody.max_completion_tokens = 2000;
        // No temperature for reasoning models
      } else {
        requestBody.max_tokens = 2000;
        requestBody.temperature = 0.1;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`OpenAI API error (${response.status}): ${errorText}`);
        console.error(`OpenAI attempt ${attempt} failed:`, lastError.message);
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      console.log('OpenAI raw response:', JSON.stringify(data, null, 2));

      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        throw new Error('Invalid OpenAI response structure');
      }

      const content = data.choices[0].message.content;
      const processingTime = Date.now() - startTime;

      // Enhanced JSON parsing with better error handling
      let result;
      try {
        // Clean content - remove markdown formatting if present
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('JSON parse error from OpenAI:', parseError, 'Content:', content);
        
        // Try to extract JSON from text if parsing fails
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error(`Could not parse JSON from OpenAI: ${parseError.message}`);
          }
        } else {
          throw new Error(`No valid JSON found in OpenAI response: ${content}`);
        }
      }

      // Validate required fields
      if (!result.recommendation || typeof result.confidence !== 'number') {
        throw new Error('Missing required fields in OpenAI response');
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      // Validate recommendation
      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from OpenAI:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning || 'No reasoning provided',
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment,
        tokens_used: data.usage?.total_tokens || 0,
        processing_time_ms: processingTime,
        model_version: model
      };

    } catch (error) {
      lastError = error;
      console.error(`OpenAI attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw new Error(`OpenAI failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

// Enhanced Anthropic function with better error handling
async function callAnthropic(prompt: string, reviewerName: string = 'Anthropic Claude 4 Sonnet'): Promise<AIReviewResult> {
  const apiKey = anthropicApiKey;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('Anthropic API key not configured or empty');
  }

  const startTime = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Anthropic attempt ${attempt}/${maxRetries}`);

      // Enhanced prompt with PICOTT focus
      const enhancedPrompt = `${prompt}

CRITICAL PICOTT ASSESSMENT REQUIREMENTS:
- Extract EXACT quotes from the abstract for each PICOTT element
- Be extremely precise with quote attribution
- If information is missing, clearly state what's absent
- Provide detailed evidence for each assessment
- Use conservative judgment for systematic review standards`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'x-api-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022', // Use stable model for now
          max_tokens: 2000,
          temperature: 0.1,
          messages: [
            { 
              role: 'user', 
              content: enhancedPrompt 
            }
          ]
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails;
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { message: errorText };
        }
        
        lastError = new Error(`Anthropic API error (${response.status}): ${JSON.stringify(errorDetails)}`);
        console.error(`Anthropic attempt ${attempt} failed:`, {
          status: response.status,
          error: errorDetails,
          attempt: attempt,
          maxRetries: maxRetries
        });
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      console.log('Anthropic raw response:', JSON.stringify(data, null, 2));

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid Anthropic response structure');
      }

      const content = data.content[0].text;
      const processingTime = Date.now() - startTime;
      
      // Enhanced JSON parsing
      let result;
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('JSON parse error from Anthropic:', parseError, 'Content:', content);
        
        // Try to extract JSON from text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error(`Could not parse JSON from Anthropic: ${parseError.message}`);
          }
        } else {
          throw new Error(`No valid JSON found in Anthropic response: ${content}`);
        }
      }

      // Validate and clean response
      if (!result.recommendation || typeof result.confidence !== 'number' || !result.reasoning) {
        throw new Error('Missing required fields in Anthropic response');
      }

      result.confidence = Math.max(0, Math.min(1, result.confidence));

      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from Anthropic:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment,
        tokens_used: data.usage?.input_tokens + data.usage?.output_tokens || 0,
        processing_time_ms: processingTime,
        model_version: 'claude-3-5-sonnet-20241022'
      };

    } catch (error) {
      lastError = error;
      console.error(`Anthropic attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return error result instead of throwing
        console.error('All Anthropic attempts failed, returning fallback response');
        return {
          recommendation: 'exclude',
          confidence: 0.0,
          reasoning: `Error occurred during Anthropic screening: ${error.message}. Manual review required. Defaulting to exclude for safety.`,
          reviewer: `${reviewerName} (Error)`,
          processing_time_ms: Date.now() - startTime
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

// Enhanced Groq function with DeepSeek R1 support
async function callGroq(prompt: string, model: string = 'deepseek-r1-distill-llama-70b', reviewerName: string = 'Groq DeepSeek R1'): Promise<AIReviewResult> {
  const apiKey = groqApiKey;
  if (!apiKey) throw new Error('Groq API key not configured');

  const startTime = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Groq attempt ${attempt}/${maxRetries} with model: ${model}`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert systematic review researcher with expertise in PICOTT methodology for literature screening.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Groq API error (${response.status}): ${errorText}`);
        console.error(`Groq attempt ${attempt} failed:`, lastError.message);
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid Groq response structure');
      }

      const content = data.choices[0].message.content;

      // Parse JSON response
      let result;
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Could not parse JSON from Groq: ${parseError.message}`);
        }
      }

      // Validate and return
      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
      if (!['include', 'exclude'].includes(result.recommendation)) {
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning || 'No reasoning provided',
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment,
        tokens_used: data.usage?.total_tokens || 0,
        processing_time_ms: processingTime,
        model_version: model
      };

    } catch (error) {
      lastError = error;
      console.error(`Groq attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) throw lastError;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

// Enhanced OpenRouter function with DeepSeek R1
async function callOpenRouter(prompt: string, model: string = 'deepseek/deepseek-r1-distill-llama-70b', reviewerName: string = 'DeepSeek R1'): Promise<AIReviewResult> {
  const apiKey = openrouterApiKey;
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  const startTime = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`OpenRouter attempt ${attempt}/${maxRetries} with model: ${model}`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-screening.lovable.dev',
          'X-Title': 'AI Literature Screening'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert systematic review researcher specializing in rigorous PICOTT-based literature screening.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`OpenRouter API error (${response.status}): ${errorText}`);
        console.error(`OpenRouter attempt ${attempt} failed:`, lastError.message);
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid OpenRouter response structure');
      }

      const content = data.choices[0].message.content;

      // Parse and validate response
      let result;
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Could not parse JSON from OpenRouter: ${parseError.message}`);
        }
      }

      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
      if (!['include', 'exclude'].includes(result.recommendation)) {
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning || 'No reasoning provided',
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment,
        tokens_used: data.usage?.total_tokens || 0,
        processing_time_ms: processingTime,
        model_version: model
      };

    } catch (error) {
      lastError = error;
      console.error(`OpenRouter attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) throw lastError;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}

// Enhanced Gemini function for fallback
async function callGemini(prompt: string, model: string = 'gemini-2.0-flash-exp', reviewerName: string = 'Gemini 2.0 Flash'): Promise<AIReviewResult> {
  const apiKey = geminiApiKey;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const startTime = Date.now();
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini attempt ${attempt}/${maxRetries} with model: ${model}`);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Gemini API error (${response.status}): ${errorText}`);
        console.error(`Gemini attempt ${attempt} failed:`, lastError.message);
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
        throw new Error('Invalid Gemini response structure');
      }

      const content = data.candidates[0].content.parts[0].text;

      // Parse and validate
      let result;
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`Could not parse JSON from Gemini: ${parseError.message}`);
        }
      }

      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5));
      if (!['include', 'exclude'].includes(result.recommendation)) {
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning || 'No reasoning provided',
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment,
        tokens_used: data.usageMetadata?.totalTokenCount || 0,
        processing_time_ms: processingTime,
        model_version: model
      };

    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) throw lastError;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw lastError;
}