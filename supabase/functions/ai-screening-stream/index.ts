import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Edge function called, checking for WebSocket upgrade...');
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";
  console.log('Upgrade header:', upgradeHeader);

  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log('Not a WebSocket request, returning 400');
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  console.log('Upgrading to WebSocket...');
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  socket.onopen = () => {
    console.log("Client connected to AI screening stream");
    socket.send(JSON.stringify({ type: "connected" }));
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received message:", message);

      if (message.type === "start_screening") {
        await handleScreeningRequest(socket, message);
      }
    } catch (error) {
      console.error("Error handling message:", error);
      socket.send(JSON.stringify({ 
        type: "error", 
        message: error.message 
      }));
    }
  };

  socket.onclose = () => {
    console.log("Client disconnected from AI screening stream");
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
});

async function handleScreeningRequest(socket: WebSocket, message: any) {
  const { references, criteria, projectId } = message;
  
  for (let i = 0; i < references.length; i++) {
    const reference = references[i];
    
    // Send progress update
    socket.send(JSON.stringify({
      type: "progress",
      current: i + 1,
      total: references.length,
      percentage: Math.round(((i + 1) / references.length) * 100),
      currentReference: {
        id: reference.id,
        title: reference.title,
        authors: reference.authors
      }
    }));

    try {
      // Process with streaming reasoning
      await processReferenceWithStreaming(socket, reference, criteria, projectId);
      
      // Small delay between references
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing reference ${reference.id}:`, error);
      socket.send(JSON.stringify({
        type: "error",
        referenceId: reference.id,
        message: error.message
      }));
    }
  }

  // Send completion
  socket.send(JSON.stringify({
    type: "complete",
    message: "Screening completed successfully"
  }));
}

async function processReferenceWithStreaming(
  socket: WebSocket, 
  reference: any, 
  criteria: any, 
  projectId: string
) {
  const openAIKey = Deno.env.get('OPENAI_API_KEY');
  const geminiKey = Deno.env.get('GEMINI_API_KEY');

  console.log('Checking API keys...');
  console.log('OpenAI key available:', !!openAIKey);
  console.log('Gemini key available:', !!geminiKey);

  if (!openAIKey) {
    console.error('Missing OPENAI_API_KEY');
    throw new Error('OpenAI API key not configured. Please add it in Supabase settings.');
  }

  if (!geminiKey) {
    console.error('Missing GEMINI_API_KEY');  
    throw new Error('Gemini API key not configured. Please add it in Supabase settings.');
  }

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

Think step by step and provide your reasoning process. For each step, explain your thinking clearly. Finally, provide your recommendation in JSON format:
{
  "recommendation": "include|exclude|maybe",
  "confidence": 0.85,
  "reasoning": "Detailed explanation of your decision"
}
`;

  // Process both reviewers in parallel but stream their reasoning
  await Promise.all([
    streamOpenAIReasoning(socket, reference.id, basePrompt + "\n\nAI Reviewer 1 - Focus on strict inclusion criteria adherence."),
    streamGeminiReasoning(socket, reference.id, basePrompt + "\n\nAI Reviewer 2 - Focus on comprehensive evidence evaluation.")
  ]);
}

async function streamOpenAIReasoning(socket: WebSocket, referenceId: string, prompt: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  
  // Send reasoning step
  socket.send(JSON.stringify({
    type: "reasoning_step",
    referenceId,
    step: {
      id: `openai-${Date.now()}`,
      reviewer: "AI Reviewer 1 (OpenAI o4-mini)",
      step: "Analyzing reference against inclusion criteria",
      reasoning: "Evaluating population, intervention, outcomes, and study design with strict adherence to criteria.",
      timestamp: new Date()
    }
  }));

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'o4-mini-2025-04-16',
      messages: [{ role: 'user', content: prompt }],
      max_completion_tokens: 1000
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[0]);
    
    // Send final decision
    socket.send(JSON.stringify({
      type: "reasoning_step",
      referenceId,
      step: {
        id: `openai-decision-${Date.now()}`,
        reviewer: "AI Reviewer 1 (OpenAI o4-mini)",
        step: `Decision: ${result.recommendation}`,
        reasoning: result.reasoning,
        confidence: result.confidence,
        timestamp: new Date()
      }
    }));
  }
}

async function streamGeminiReasoning(socket: WebSocket, referenceId: string, prompt: string) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  
  // Send reasoning step
  socket.send(JSON.stringify({
    type: "reasoning_step",
    referenceId,
    step: {
      id: `gemini-${Date.now()}`,
      reviewer: "AI Reviewer 2 (Google Gemini)",
      step: "Comprehensive evidence evaluation",
      reasoning: "Assessing scientific value and potential relevance beyond strict criteria boundaries.",
      timestamp: new Date()
    }
  }));

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

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text;
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[0]);
    
    // Send final decision
    socket.send(JSON.stringify({
      type: "reasoning_step",
      referenceId,
      step: {
        id: `gemini-decision-${Date.now()}`,
        reviewer: "AI Reviewer 2 (Google Gemini)",
        step: `Decision: ${result.recommendation}`,
        reasoning: result.reasoning,
        confidence: result.confidence,
        timestamp: new Date()
      }
    }));
  }
}