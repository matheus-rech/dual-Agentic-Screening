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

    // Evaluate agreement
    const agreement = reviewer1Result.recommendation === reviewer2Result.recommendation;
    const finalDecision = agreement ? reviewer1Result.recommendation : 'conflict';
    const averageConfidence = agreement ? (reviewer1Result.confidence + reviewer2Result.confidence) / 2 : 0;

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.1
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    const result = JSON.parse(content);
    return {
      ...result,
      reviewer: 'AI Reviewer 1 (OpenAI GPT-4o)'
    };
  } catch (e) {
    throw new Error('Invalid JSON response from OpenAI');
  }
}

async function callGemini(prompt: string): Promise<AIReviewResult> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini API key not configured');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.1,
        maxOutputTokens: 1000
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  
  try {
    const result = JSON.parse(content);
    return {
      ...result,
      reviewer: 'AI Reviewer 2 (Google Gemini)'
    };
  } catch (e) {
    throw new Error('Invalid JSON response from Gemini');
  }
}