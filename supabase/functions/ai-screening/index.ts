import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

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
    const { referenceId, reference, criteria, projectId }: ScreeningRequest = await req.json();
    
    console.log('Starting dual AI screening for reference:', referenceId);

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

ANALYSIS REQUIREMENTS:
1. First, assess each PICOTT element and criteria against the abstract
2. For each element, provide either:
   - Direct quote from abstract if explicitly stated
   - Your rationale if inferred or absent
3. Then provide your final reasoning and decision

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

    // Parallel API calls to both AI providers
    const [reviewer1Result, reviewer2Result] = await Promise.all([
      callOpenAI(reviewer1Prompt),
      callGemini(reviewer2Prompt)
    ]);

    console.log('Reviewer 1 result:', reviewer1Result);
    console.log('Reviewer 2 result:', reviewer2Result);

    // Evaluate agreement and resolve conflicts
    const agreement = reviewer1Result.recommendation === reviewer2Result.recommendation;
    let finalDecision: string;
    let averageConfidence: number;
    
    if (agreement) {
      finalDecision = reviewer1Result.recommendation;
      averageConfidence = (reviewer1Result.confidence + reviewer2Result.confidence) / 2;
    } else {
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

async function callOpenAI(prompt: string): Promise<AIReviewResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OpenAI API key not configured');

  // Define JSON schema for structured output
  const responseSchema = {
    type: "object",
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
        properties: {
          population: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          },
          intervention: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          },
          comparator: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          },
          outcome: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          },
          timeframe: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          },
          study_design: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["present", "absent", "unclear"] },
              evidence: { type: "string" }
            },
            required: ["status", "evidence"],
            additionalProperties: false
          }
        },
        required: ["population", "intervention", "comparator", "outcome", "timeframe", "study_design"],
        additionalProperties: false
      },
      criteria_assessment: {
        type: "object",
        properties: {
          inclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["met", "not_met", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"],
              additionalProperties: false
            }
          },
          exclusion_criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                status: { type: "string", enum: ["violated", "not_violated", "unclear"] },
                evidence: { type: "string" }
              },
              required: ["criterion", "status", "evidence"],
              additionalProperties: false
            }
          }
        },
        required: ["inclusion_criteria", "exclusion_criteria"],
        additionalProperties: false
      },
      reasoning: {
        type: "string"
      }
    },
    required: ["recommendation", "confidence", "picott_assessment", "criteria_assessment", "reasoning"],
    additionalProperties: false
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
        lastError = new Error(`OpenAI API error (${response.status}): ${errorText}`);
        console.error(`OpenAI attempt ${attempt} failed:`, lastError.message);
        
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
        reviewer: 'OpenAI GPT-4o',
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
        lastError = new Error(`Gemini API error (${response.status}): ${errorText}`);
        console.error(`Gemini attempt ${attempt} failed:`, lastError.message);
        
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