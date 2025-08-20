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
  };
  projectId: string;
}

interface AIReviewResult {
  recommendation: 'include' | 'exclude' | 'maybe';
  confidence: number;
  reasoning: string;
  reviewer: string;
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

INCLUSION CRITERIA:
Population: ${criteria.population || 'Not specified'}
Intervention: ${criteria.intervention || 'Not specified'}
Comparator: ${criteria.comparator || 'Not specified'}
Outcome: ${criteria.outcome || 'Not specified'}
Study Designs: ${criteria.studyDesigns?.join(', ') || 'Not specified'}
${criteria.timeframeStart && criteria.timeframeEnd ? `Timeframe: ${criteria.timeframeStart} to ${criteria.timeframeEnd}` : ''}
${criteria.timeframeDescription ? `Timeframe Details: ${criteria.timeframeDescription}` : ''}

SPECIFIC INCLUSION CRITERIA:
${criteria.inclusionCriteria?.filter(c => c.trim()).join('\n• ') || 'Not specified'}

SPECIFIC EXCLUSION CRITERIA:
${criteria.exclusionCriteria?.filter(c => c.trim()).join('\n• ') || 'Not specified'}

Provide your response in this exact JSON format:
{
  "recommendation": "include|exclude|maybe",
  "confidence": 0.85,
  "reasoning": "Detailed explanation of your decision"
}
`;

    const reviewer1Prompt = `${basePrompt}

AI Reviewer 1 - Focus on strict inclusion criteria adherence. Be conservative and ensure all criteria are clearly met before recommending inclusion.`;

    const reviewer2Prompt = `${basePrompt}

AI Reviewer 2 - Focus on comprehensive evidence evaluation. Consider the broader scientific value and potential relevance even if some criteria are borderline.`;

    // Parallel API calls to both AI providers
    const [reviewer1Result, reviewer2Result] = await Promise.all([
      callOpenAI(reviewer1Prompt),
      callGemini(reviewer2Prompt)
    ]);

    console.log('Reviewer 1 result:', reviewer1Result);
    console.log('Reviewer 2 result:', reviewer2Result);

    // Evaluate agreement
    const agreement = reviewer1Result.recommendation === reviewer2Result.recommendation;
    const finalDecision = agreement ? reviewer1Result.recommendation : 'maybe';
    const averageConfidence = agreement ? (reviewer1Result.confidence + reviewer2Result.confidence) / 2 : Math.max(reviewer1Result.confidence, reviewer2Result.confidence);

    // Log screening results
    const { error: logError } = await supabase
      .from('ai_screening_log')
      .insert({
        project_id: projectId,
        reference_id: referenceId,
        screening_stage: 'title_abstract',
        primary_model_decision: reviewer1Result.recommendation,
        primary_model_confidence: reviewer1Result.confidence,
        secondary_model_decision: reviewer2Result.recommendation,
        secondary_model_confidence: reviewer2Result.confidence,
        final_decision: finalDecision,
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
        status: finalDecision,
        ai_recommendation: finalDecision,
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
        enum: ["include", "exclude", "maybe"]
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      reasoning: {
        type: "string"
      }
    },
    required: ["recommendation", "confidence", "reasoning"],
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
      if (!['include', 'exclude', 'maybe'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from OpenAI:', result.recommendation, 'defaulting to maybe');
        result.recommendation = 'maybe';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: 'OpenAI GPT-4o'
      };

    } catch (error) {
      lastError = error;
      console.error(`OpenAI attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All OpenAI attempts failed, returning fallback response');
        return {
          recommendation: 'maybe',
          confidence: 0.0,
          reasoning: `Error occurred during OpenAI screening: ${error.message}. Manual review required.`,
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

CRITICAL: You MUST respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "recommendation": "include|exclude|maybe",
  "confidence": 0.85,
  "reasoning": "Your detailed explanation here"
}

The recommendation must be exactly one of: include, exclude, maybe
The confidence must be a number between 0.0 and 1.0
The reasoning must be a string explaining your decision.`;

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
      if (!['include', 'exclude', 'maybe'].includes(result.recommendation)) {
        console.warn('Invalid recommendation from Gemini:', result.recommendation, 'defaulting to maybe');
        result.recommendation = 'maybe';
      }

      return {
        recommendation: result.recommendation,
        confidence: result.confidence,
        reasoning: result.reasoning,
        reviewer: 'Google Gemini'
      };

    } catch (error) {
      lastError = error;
      console.error(`Gemini attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        // Return fallback response
        console.error('All Gemini attempts failed, returning fallback response');
        return {
          recommendation: 'maybe',
          confidence: 0.0,
          reasoning: `Error occurred during Gemini screening: ${error.message}. Manual review required.`,
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