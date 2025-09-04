import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

// Input validation and sanitization
function validateAndSanitizeInput(data: any) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request data');
  }

  // Validate required fields for single reference screening
  const required = ['referenceId', 'reference', 'criteria', 'projectId'];
  for (const field of required) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Sanitize text inputs
  const sanitize = (text: string) => {
    if (!text || typeof text !== 'string') return '';
    return text
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 50000); // Limit length
  };

  // Validate and sanitize reference (single object)
  if (!data.reference || typeof data.reference !== 'object') {
    throw new Error('Reference must be a valid object');
  }

  // Sanitize reference fields
  data.reference = {
    title: sanitize(data.reference.title || ''),
    abstract: sanitize(data.reference.abstract || ''),
    authors: sanitize(data.reference.authors || ''),
    year: parseInt(data.reference.year) || new Date().getFullYear(),
    journal: sanitize(data.reference.journal || ''),
    doi: sanitize(data.reference.doi || ''),
    url: data.reference.url ? data.reference.url.toString() : ''
  };

  // Validate project ID (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(data.projectId)) {
    throw new Error('Invalid project ID format');
  }

  // Validate referenceId format (can be UUID or other string)
  if (!data.referenceId || typeof data.referenceId !== 'string') {
    throw new Error('Invalid reference ID format');
  }

  return data;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
const vercelAIToken = Deno.env.get('VERCEL_AI_GATEWAY_TOKEN');

interface ScreeningRequest {
  referenceId: string;
  reference: {
    title: string;
    abstract: string;
    authors: string;
    journal?: string;
    year?: number;
    doi?: string;
  };
  criteria: {
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
  };
  projectId: string;
}

interface AIReviewResult {
  recommendation: 'include' | 'exclude';
  confidence: number;
  reasoning: string;
  reviewer: string;
  picott_assessment?: {
    population: { status: string; evidence: string };
    intervention: { status: string; evidence: string };
    comparator: { status: string; evidence: string };
    outcome: { status: string; evidence: string };
    timeframe: { status: string; evidence: string };
    study_design: { status: string; evidence: string };
  };
  criteria_assessment?: {
    inclusion_criteria: Array<{ criterion: string; status: string; evidence: string }>;
    exclusion_criteria: Array<{ criterion: string; status: string; evidence: string }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input with security checks
    const rawData = await req.json();
    const validatedData = validateAndSanitizeInput(rawData);
    
    const { referenceId, reference, criteria, projectId }: ScreeningRequest = validatedData;
    
    console.log('Starting dual AI screening for reference:', referenceId);
    
    // Security logging
    console.log('Security validation passed for request:', {
      referenceId,
      projectId,
      referenceTitle: reference.title?.substring(0, 100)
    });

    // Create specialized prompts for each reviewer
    const basePrompt = `
You are an expert systematic review researcher. Analyze this research reference against the provided inclusion criteria.

REFERENCE:
Title: ${reference.title}
Abstract: ${reference.abstract}
Authors: ${reference.authors}
Journal: ${reference.journal || 'Not specified'}
Year: ${reference.year || 'Not specified'}

SCREENING CRITERIA:

PICO Framework:
• Population: ${criteria.population || 'Not specified'}
• Intervention: ${criteria.intervention || 'Not specified'}
• Comparator: ${criteria.comparator || 'Not specified'}
• Outcome: ${criteria.outcome || 'Not specified'}

Study Types: ${criteria.studyDesigns?.join(', ') || 'Not specified'}

Timeframe/Follow-up Period:
${criteria.timeframeStart && criteria.timeframeEnd ? `• Study Period: ${criteria.timeframeStart} to ${criteria.timeframeEnd}` : ''}
${criteria.timeframeDescription ? `• Follow-up Details: ${criteria.timeframeDescription}` : ''}
${!criteria.timeframeStart && !criteria.timeframeEnd && !criteria.timeframeDescription ? '• Not specified' : ''}

INCLUSION CRITERIA:
${criteria.inclusionCriteria?.filter(c => c.trim()).map(c => `• ${c}`).join('\n') || '• Not specified'}

EXCLUSION CRITERIA:
${criteria.exclusionCriteria?.filter(c => c.trim()).map(c => `• ${c}`).join('\n') || '• Not specified'}

You MUST make a definitive decision: either INCLUDE or EXCLUDE. "Maybe" is NOT an option.

CRITICAL ANALYSIS REQUIREMENTS - STRUCTURED PICOTT ASSESSMENT:

Your output MUST BEGIN with a systematic structured analysis of each PICOTT element. For EACH letter of PICOTT, you must provide:

1. **DIRECT SOURCE QUOTE**: Extract the exact text from the abstract that relates to this element (use "Not mentioned" if absent)
2. **YOUR ASSESSMENT/REASONING**: Explain WHY that quote (or absence) means the criteria is fulfilled or not fulfilled

PICOTT ANALYSIS FORMAT REQUIRED:
• **P (Population)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets population criteria]"
• **I (Intervention)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets intervention criteria]" 
• **C (Comparator)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets comparator criteria]"
• **O (Outcome)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets outcome criteria]"
• **T (Timeframe)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets timeframe criteria]"
• **T (Study Type)**: Quote: "[exact quote or 'Not mentioned']" → Assessment: "[Your reasoning about whether this meets study design criteria]"

THEN assess inclusion/exclusion criteria systematically with the same quote → assessment approach.

AFTER completing your PICOTT analysis and criteria assessment, you MUST provide an:

**OVERALL REASONING SUMMARY**: 
Write a concise narrative paragraph (2-4 sentences) that synthesizes the key aspects that led to your include/exclude decision. This should address:
- Which PICOTT elements were strongest/weakest for this abstract
- Which inclusion criteria were most clearly met or failed  
- The decisive factors that tipped your decision toward include or exclude
- Any significant gaps or strengths in the evidence

Use thorough analysis, reflection, and reasoning to determine if the abstract is more likely to meet the inclusion criteria or not. Even with uncertainty, make the best decision based on available evidence.

Provide your response in this exact JSON format:
{
  "recommendation": "include|exclude",
  "confidence": 0.xx,
  "picott_assessment": {
    "population": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "intervention": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "comparator": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "outcome": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "timeframe": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "study_design": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"}
  },
  "criteria_assessment": {
    "inclusion_criteria": [
      {"criterion": "criterion text", "status": "met|not_met|unclear", "evidence": "Direct quote or rationale"}
    ],
    "exclusion_criteria": [
      {"criterion": "criterion text", "status": "violated|not_violated|unclear", "evidence": "Direct quote or rationale"}
    ]
  },
  "reasoning": "Final decision reasoning based on the above assessment and why you chose include/exclude despite any uncertainties"
}

DECISION GUIDELINES:
- If the study clearly meets most criteria → INCLUDE
- If the study clearly fails key criteria → EXCLUDE  
- If borderline/uncertain → Use your best judgment based on which is more likely
- Lower confidence scores (0.3-0.6) are acceptable for difficult decisions
- Always explain your reasoning, especially for borderline cases

CONFIDENCE SCORING:
- 0.3-0.5: Difficult decision with significant uncertainty but best judgment made
- 0.6-0.8: Reasonable confidence with some minor concerns
- 0.9-1.0: High confidence, clear evidence supporting decision
`;

    const reviewer1Prompt = `${basePrompt}

AI Reviewer 1 - CONSERVATIVE APPROACH: Apply strict criteria adherence. If there's significant doubt about meeting inclusion criteria, lean toward EXCLUDE. Only recommend INCLUDE when criteria are clearly met.`;

    const reviewer2Prompt = `${basePrompt}

AI Reviewer 2 - COMPREHENSIVE APPROACH: Consider broader scientific value and potential relevance. If the study could contribute valuable insights despite minor criteria gaps, lean toward INCLUDE. Only recommend EXCLUDE when clearly irrelevant.`;

    // Hybrid AI provider selection with Vercel AI Gateway as primary
    let reviewer1Result: AIReviewResult;
    let reviewer2Result: AIReviewResult;
    let primaryProvider = 'none';

    try {
      // PRIMARY: Vercel AI Gateway (Claude + GPT) with load balancing
      if (vercelAIToken) {
        console.log('Attempting Vercel AI Gateway + Gemini hybrid strategy');
        const [result1, result2] = await Promise.all([
          callVercelAI(reviewer1Prompt, 'claude-3-5-sonnet-20241022', 'Vercel AI Gateway (Claude Conservative)'),
          callGeminiWithFallback(reviewer2Prompt)
        ]);
        
        reviewer1Result = result1;
        reviewer2Result = result2;
        primaryProvider = 'vercel-ai-gateway';
        console.log('Successfully using Vercel AI Gateway + Gemini strategy');
        
        // Check if Gemini failed and use Vercel AI Gateway GPT fallback
        if (reviewer2Result.reviewer.includes('Error') && reviewer2Result.confidence === 0) {
          console.log('Gemini unavailable, switching to Vercel AI Gateway GPT for reviewer 2');
          reviewer2Result = await callVercelAI(reviewer2Prompt, 'gpt-4o-mini', 'Vercel AI Gateway (GPT Comprehensive)');
        }
      } else {
        throw new Error('Vercel AI Gateway token not configured');
      }
      
    } catch (error) {
      console.error('Vercel AI Gateway strategy failed, trying OpenRouter + Gemini:', error);
      
      // FALLBACK 1: OpenRouter (Claude) + Gemini approach
      try {
        const [result1, result2] = await Promise.all([
          callOpenRouter(reviewer1Prompt, 'anthropic/claude-3-haiku', 'OpenRouter (Claude-3-Haiku Conservative)'),
          callGeminiWithFallback(reviewer2Prompt)
        ]);
        
        reviewer1Result = result1;
        reviewer2Result = result2;
        primaryProvider = 'openrouter';
        console.log('Successfully using OpenRouter + Gemini fallback strategy');
        
        // Check if Gemini failed and needs OpenAI fallback
        if (reviewer2Result.reviewer.includes('Error') && reviewer2Result.confidence === 0) {
          console.log('Gemini unavailable, switching to OpenAI for reviewer 2');
          reviewer2Result = await callOpenAI(reviewer2Prompt, 'OpenAI GPT-4o (Fallback)');
        }
        
      } catch (secondError) {
        console.error('OpenRouter fallback failed, trying OpenAI + Gemini:', secondError);
        
        // FALLBACK 2: Original OpenAI + Gemini approach
        try {
          const [result1, result2] = await Promise.all([
            callOpenAI(reviewer1Prompt),
            callGeminiWithFallback(reviewer2Prompt)
          ]);
          
          reviewer1Result = result1;
          reviewer2Result = result2;
          primaryProvider = 'openai';
          console.log('Successfully using OpenAI + Gemini fallback strategy');
          
          // Check if Gemini failed and use OpenAI backup
          if (reviewer2Result.reviewer.includes('Error') && reviewer2Result.confidence === 0) {
            console.log('Gemini unavailable in fallback, using OpenAI for both reviewers');
            reviewer2Result = await callOpenAI(reviewer2Prompt, 'OpenAI GPT-4o (Backup)');
          }
          
        } catch (thirdError) {
          console.error('OpenAI + Gemini fallback failed, attempting final OpenAI only:', thirdError);
          
          // FALLBACK 3: OpenAI only (last resort)
          reviewer1Result = await callOpenAI(reviewer1Prompt);
          reviewer2Result = await callOpenAI(reviewer2Prompt, 'OpenAI GPT-4o (Final Backup)');
          primaryProvider = 'openai-only';
          console.log('Successfully switched to OpenAI-only emergency mode');
        }
      }
    }

    console.log('Reviewer 1 result:', reviewer1Result);
    console.log('Reviewer 2 result:', reviewer2Result);
    console.log('Primary provider used:', primaryProvider);

    // Enhanced agreement evaluation with error handling
    const bothReviewersValid = reviewer1Result.confidence > 0 && reviewer2Result.confidence > 0;
    const agreement = bothReviewersValid && (reviewer1Result.recommendation === reviewer2Result.recommendation);
    let finalDecision: string;
    let averageConfidence: number;
    
    if (agreement && bothReviewersValid) {
      finalDecision = reviewer1Result.recommendation;
      averageConfidence = (reviewer1Result.confidence + reviewer2Result.confidence) / 2;
    } else if (bothReviewersValid) {
      // Conflict resolution: Use the decision with higher confidence
      if (reviewer1Result.confidence > reviewer2Result.confidence) {
        finalDecision = reviewer1Result.recommendation;
        averageConfidence = reviewer1Result.confidence;
      } else if (reviewer2Result.confidence > reviewer1Result.confidence) {
        finalDecision = reviewer2Result.recommendation;
        averageConfidence = reviewer2Result.confidence;
      } else {
        // Equal confidence: Default to conservative approach (exclude)
        finalDecision = 'exclude';
        averageConfidence = Math.max(reviewer1Result.confidence, reviewer2Result.confidence);
      }
    } else {
      // One or both reviewers failed - use the valid one or default to exclude
      if (reviewer1Result.confidence > 0) {
        finalDecision = reviewer1Result.recommendation;
        averageConfidence = reviewer1Result.confidence;
        console.log('Using Reviewer 1 result due to Reviewer 2 failure');
      } else if (reviewer2Result.confidence > 0) {
        finalDecision = reviewer2Result.recommendation;
        averageConfidence = reviewer2Result.confidence;
        console.log('Using Reviewer 2 result due to Reviewer 1 failure');
      } else {
        // Both failed - default to exclude for safety
        finalDecision = 'exclude';
        averageConfidence = 0.1;
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

    // Log screening results
    const { error: logError } = await supabase
      .from('ai_screening_log')
      .insert({
        project_id: projectId,
        reference_id: referenceId,
        screening_stage: 'title_abstract_screening',
        primary_model_decision: mapDecision(reviewer1Result.recommendation),
        primary_model_confidence: reviewer1Result.confidence,
        secondary_model_decision: mapDecision(reviewer2Result.recommendation),
        secondary_model_confidence: reviewer2Result.confidence,
        final_decision: finalDecisionMapped,
        decision_reason: {
          reviewer1: reviewer1Result,
          reviewer2: reviewer2Result,
          agreement,
          conflict: !agreement
        }
      });

    if (logError) {
      console.error('Error logging screening results:', logError);
    }

    // Update reference status
    const { error: updateError } = await supabase
      .from('references')
      .update({
        status: finalDecisionMapped,
        ai_recommendation: finalDecisionMapped,
        ai_confidence: averageConfidence,
        ai_screening_details: {
          reviewer1: reviewer1Result,
          reviewer2: reviewer2Result,
          agreement,
          processed_at: new Date().toISOString()
        },
        ai_conflict_flag: !agreement
      })
      .eq('id', referenceId);

    if (updateError) {
      console.error('Error updating reference:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      referenceId,
      finalDecision,
      agreement,
      confidence: averageConfidence,
      reviewer1: reviewer1Result,
      reviewer2: reviewer2Result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-screening function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callOpenAI(prompt: string, reviewerName: string = 'OpenAI GPT-4o'): Promise<AIReviewResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Define JSON schema for structured output with strict compliance
  const responseSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendation: {
        type: "string",
        enum: ["include", "exclude"]
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      picott_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          population: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          intervention: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          comparator: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          outcome: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          timeframe: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          study_design: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          }
        },
        required: ["population", "intervention", "comparator", "outcome", "timeframe", "study_design"]
      },
      criteria_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          inclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["met", "not_met", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"]
            }
          },
          exclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["violated", "not_violated", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"]
            }
          }
        },
        required: ["inclusion_criteria", "exclusion_criteria"]
      },
      reasoning: {
        type: "string"
      }
    },
    required: ["recommendation", "confidence", "picott_assessment", "criteria_assessment", "reasoning"]
  };

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`OpenAI attempt ${attempt}/${maxRetries}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are an expert systematic review researcher. Always respond with valid JSON in the exact format requested.'
            },
            { 
              role: 'user', 
              content: prompt 
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "screening_result",
              schema: responseSchema,
              strict: true
            }
          }
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
        
        lastError = new Error(`OpenAI API error (${response.status}): ${JSON.stringify(errorDetails)}`);
        console.error(`OpenAI attempt ${attempt} failed:`, {
          status: response.status,
          error: errorDetails,
          attempt: attempt,
          maxRetries: maxRetries
        });
        
        // For schema errors, don't retry as they won't resolve
        if (response.status === 400 && errorText.includes('Invalid schema')) {
          console.error('Schema validation error - not retrying:', errorDetails);
          throw lastError;
        }
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }

      const data = await response.json();
      console.log('OpenAI raw response:', JSON.stringify(data, null, 2));

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid OpenAI response structure');
      }

      const content = data.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error from OpenAI:', parseError, 'Content:', content);
        throw new Error(`Invalid JSON from OpenAI: ${parseError.message}`);
      }

      // Validate the result structure
      if (!result.recommendation || typeof result.confidence !== 'number' || !result.reasoning) {
        throw new Error('Missing required fields in OpenAI response');
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      // Ensure recommendation is valid
      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from OpenAI:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: reviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment
      };

    } catch (error) {
      lastError = error;
      console.error(`OpenAI attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All OpenAI attempts failed, returning fallback response');
        return {
          recommendation: 'exclude',
          confidence: 0.0,
          reasoning: `Error occurred during OpenAI screening: ${error.message}. Manual review required. Defaulting to exclude for safety.`,
          reviewer: 'OpenAI GPT-4o (Error)'
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

async function callGemini(prompt: string): Promise<AIReviewResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const maxRetries = 3;
  let lastError;

  // Enhanced prompt with strict JSON instructions
  const jsonPrompt = `${prompt}

You MUST make a definitive decision: either INCLUDE or EXCLUDE. "Maybe" is NOT an option.

CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "recommendation": "include|exclude",
  "confidence": 0.xx,
  "picott_assessment": {
    "population": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "intervention": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "comparator": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "outcome": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "timeframe": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "study_design": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"}
  },
  "criteria_assessment": {
    "inclusion_criteria": [
      {"criterion": "criterion text", "status": "met|not_met|unclear", "evidence": "Direct quote or rationale"}
    ],
    "exclusion_criteria": [
      {"criterion": "criterion text", "status": "violated|not_violated|unclear", "evidence": "Direct quote or rationale"}
    ]
  },
  "reasoning": "Final decision reasoning based on the above assessment and why you chose include/exclude despite any uncertainties"
}

The recommendation must be exactly one of: include, exclude
The confidence must be a number between 0.0 and 1.0 based on your actual certainty
The reasoning must be a string explaining your decision and addressing any uncertainties.
Use analysis and reasoning to make the best decision possible even with incomplete information.`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Gemini attempt ${attempt}/${maxRetries}`);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ 
            parts: [{ text: jsonPrompt }] 
          }],
          generationConfig: { 
            temperature: 0.1,
            maxOutputTokens: 1000,
            responseMimeType: "application/json"
          }
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
        
        lastError = new Error(`Gemini API error (${response.status}): ${JSON.stringify(errorDetails)}`);
        console.error(`Gemini attempt ${attempt} failed:`, {
          status: response.status,
          error: errorDetails,
          attempt: attempt,
          maxRetries: maxRetries
        });
        
        // For quota errors, provide helpful message
        if (response.status === 429) {
          const quotaError = new Error(`Gemini API quota exceeded. Please wait for quota reset or upgrade your plan. Details: ${JSON.stringify(errorDetails)}`);
          console.error('Gemini quota exceeded:', errorDetails);
          throw quotaError;
        }
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        continue;
      }

      const data = await response.json();
      console.log('Gemini raw response:', JSON.stringify(data, null, 2));
      
      // Enhanced parsing with multiple fallback strategies
      let content = '';
      
      if (data.candidates && 
          data.candidates.length > 0 && 
          data.candidates[0].content && 
          data.candidates[0].content.parts && 
          data.candidates[0].content.parts.length > 0) {
        content = data.candidates[0].content.parts[0].text;
      } else if (data.error) {
        throw new Error(`Gemini API error: ${data.error.message || 'Unknown error'}`);
      } else {
        console.error('Unexpected Gemini response structure:', data);
        throw new Error('Gemini returned unexpected response structure');
      }
      
      // Clean the content - remove markdown formatting if present
      content = content.trim();
      if (content.startsWith('```json')) {
        content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (content.startsWith('```')) {
        content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error from Gemini:', parseError, 'Content:', content);
        
        // Try to extract JSON from text if parsing fails
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error(`Could not parse JSON from Gemini response: ${parseError.message}`);
          }
        } else {
          throw new Error(`No valid JSON found in Gemini response: ${content}`);
        }
      }

      // Validate the result structure
      if (!result || typeof result !== 'object') {
        throw new Error('Gemini response is not a valid object');
      }

      if (!result.recommendation || typeof result.confidence !== 'number' || !result.reasoning) {
        console.warn('Invalid Gemini response structure:', result);
        throw new Error('Missing required fields in Gemini response');
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      // Ensure recommendation is valid
      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from Gemini:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: 'Google Gemini',
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment
      };

    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All Gemini attempts failed, returning fallback response');
        return {
          recommendation: 'exclude',
          confidence: 0.0,
          reasoning: `Error occurred during Gemini screening: ${error.message}. Manual review required. Defaulting to exclude for safety.`,
          reviewer: 'Google Gemini (Error)'
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

async function callGeminiWithFallback(prompt: string): Promise<AIReviewResult> {
  try {
    // First, try the regular Gemini call
    return await callGemini(prompt);
  } catch (error) {
    console.error('Gemini call failed, analyzing error:', error.message);
    
    // Check if it's a quota error
    if (error.message.includes('quota exceeded') || error.message.includes('429')) {
      console.log('Gemini quota exceeded - will be handled by fallback strategy');
      // Return an error result that will trigger OpenAI fallback
      return {
        recommendation: 'exclude',
        confidence: 0.0,
        reasoning: `Gemini API quota exceeded. Fallback to OpenAI will be attempted. Details: ${error.message}`,
        reviewer: 'Google Gemini (Quota Exceeded)'
      };
    }
    
    // For other errors, still return error result but with different message
    return {
      recommendation: 'exclude',
      confidence: 0.0,
      reasoning: `Gemini API error encountered. Details: ${error.message}. Manual review may be required.`,
      reviewer: 'Google Gemini (Error)'
    };
  }
}

async function callOpenRouter(prompt: string, model: string = 'anthropic/claude-3-haiku', reviewerName?: string): Promise<AIReviewResult> {
  const apiKey = openRouterApiKey;
  if (!apiKey) throw new Error('OpenRouter API key not configured');

  // Default reviewer name based on model
  const defaultReviewerName = reviewerName || `OpenRouter (${model})`;
  
  // Enhanced prompt with strict JSON instructions for OpenRouter
  const jsonPrompt = `${prompt}

CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "recommendation": "include|exclude",
  "confidence": 0.xx,
  "picott_assessment": {
    "population": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "intervention": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "comparator": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "outcome": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "timeframe": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"},
    "study_design": {"status": "present|absent|unclear", "evidence": "Direct quote or rationale"}
  },
  "criteria_assessment": {
    "inclusion_criteria": [
      {"criterion": "criterion text", "status": "met|not_met|unclear", "evidence": "Direct quote or rationale"}
    ],
    "exclusion_criteria": [
      {"criterion": "criterion text", "status": "violated|not_violated|unclear", "evidence": "Direct quote or rationale"}
    ]
  },
  "reasoning": "Final decision reasoning based on the above assessment and why you chose include/exclude despite any uncertainties"
}

The recommendation must be exactly one of: include, exclude
The confidence must be a number between 0.0 and 1.0 based on your actual certainty
The reasoning must be a string explaining your decision and addressing any uncertainties.`;

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
          'HTTP-Referer': 'https://lovable.dev',
          'X-Title': 'AI Literature Screening Tool'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert systematic review researcher. Always respond with valid JSON in the exact format requested.'
            },
            { 
              role: 'user', 
              content: jsonPrompt 
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
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
        
        lastError = new Error(`OpenRouter API error (${response.status}): ${JSON.stringify(errorDetails)}`);
        console.error(`OpenRouter attempt ${attempt} failed:`, {
          status: response.status,
          error: errorDetails,
          attempt: attempt,
          maxRetries: maxRetries,
          model: model
        });
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      console.log('OpenRouter raw response:', JSON.stringify(data, null, 2));

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid OpenRouter response structure');
      }

      const content = data.choices[0].message.content;
      
      // Clean the content - remove markdown formatting if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      let result;
      try {
        result = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('JSON parse error from OpenRouter:', parseError, 'Content:', cleanContent);
        
        // Try to extract JSON from text if parsing fails
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            result = JSON.parse(jsonMatch[0]);
          } catch (secondParseError) {
            throw new Error(`Could not parse JSON from OpenRouter response: ${parseError.message}`);
          }
        } else {
          throw new Error(`No valid JSON found in OpenRouter response: ${cleanContent}`);
        }
      }

      // Validate the result structure
      if (!result.recommendation || typeof result.confidence !== 'number' || !result.reasoning) {
        throw new Error('Missing required fields in OpenRouter response');
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      // Ensure recommendation is valid
      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from OpenRouter:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: defaultReviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment
      };

    } catch (error) {
      lastError = error;
      console.error(`OpenRouter attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All OpenRouter attempts failed, returning fallback response');
        return {
          recommendation: 'exclude',
          confidence: 0.0,
          reasoning: `Error occurred during OpenRouter screening: ${error.message}. Manual review required. Defaulting to exclude for safety.`,
          reviewer: `${defaultReviewerName} (Error)`
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

async function callVercelAI(prompt: string, model: string = 'claude-3-5-sonnet-20241022', reviewerName?: string): Promise<AIReviewResult> {
  const apiToken = vercelAIToken;
  if (!apiToken) throw new Error('Vercel AI Gateway token not configured');

  // Default reviewer name based on model
  const defaultReviewerName = reviewerName || `Vercel AI Gateway (${model})`;
  
  // Define the structured output schema
  const responseSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendation: {
        type: "string",
        enum: ["include", "exclude"]
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      picott_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          population: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          intervention: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          comparator: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          outcome: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          timeframe: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          },
          study_design: {
            type: "object",
            additionalProperties: false,
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"]
          }
        },
        required: ["population", "intervention", "comparator", "outcome", "timeframe", "study_design"]
      },
      criteria_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          inclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["met", "not_met", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"]
            }
          },
          exclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["violated", "not_violated", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"]
            }
          }
        },
        required: ["inclusion_criteria", "exclusion_criteria"]
      },
      reasoning: {
        type: "string"
      }
    },
    required: ["recommendation", "confidence", "picott_assessment", "criteria_assessment", "reasoning"]
  };

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Vercel AI Gateway attempt ${attempt}/${maxRetries} with model: ${model}`);

      const response = await fetch('https://api.vercel.com/v1/ai/gateway/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert systematic review researcher. Always respond with valid JSON in the exact format requested.'
            },
            { 
              role: 'user', 
              content: prompt 
            }
          ],
          max_tokens: 1000,
          temperature: 0.1,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "screening_result",
              schema: responseSchema,
              strict: true
            }
          }
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
        
        lastError = new Error(`Vercel AI Gateway error (${response.status}): ${JSON.stringify(errorDetails)}`);
        console.error(`Vercel AI Gateway attempt ${attempt} failed:`, {
          status: response.status,
          error: errorDetails,
          attempt: attempt,
          maxRetries: maxRetries,
          model: model
        });
        
        // For schema errors or auth errors, don't retry
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          console.error('Vercel AI Gateway config error - not retrying:', errorDetails);
          throw lastError;
        }
        
        if (attempt === maxRetries) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      console.log('Vercel AI Gateway raw response:', JSON.stringify(data, null, 2));

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid Vercel AI Gateway response structure');
      }

      const content = data.choices[0].message.content;
      let result;

      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('JSON parse error from Vercel AI Gateway:', parseError, 'Content:', content);
        throw new Error(`Invalid JSON from Vercel AI Gateway: ${parseError.message}`);
      }

      // Validate the result structure
      if (!result.recommendation || typeof result.confidence !== 'number' || !result.reasoning) {
        throw new Error('Missing required fields in Vercel AI Gateway response');
      }

      // Ensure confidence is between 0 and 1
      result.confidence = Math.max(0, Math.min(1, result.confidence));

      // Ensure recommendation is valid
      if (!['include', 'exclude'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from Vercel AI Gateway:', result.recommendation, 'defaulting to exclude');
        result.recommendation = 'exclude';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: defaultReviewerName,
        picott_assessment: result.picott_assessment,
        criteria_assessment: result.criteria_assessment
      };

    } catch (error) {
      lastError = error;
      console.error(`Vercel AI Gateway attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All Vercel AI Gateway attempts failed, returning fallback response');
        return {
          recommendation: 'exclude',
          confidence: 0.0,
          reasoning: `Error occurred during Vercel AI Gateway screening: ${error.message}. Manual review required. Defaulting to exclude for safety.`,
          reviewer: `${defaultReviewerName} (Error)`
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}