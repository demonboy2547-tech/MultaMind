'use server';

// src/ai/flows/critique-gpt-response.ts
import { callMultaAgent } from '@/lib/agents';
import { ChatMessage } from '@/lib/types';

/**
 * @deprecated This flow is deprecated and will be removed. Use `reviewGptWithGemini` from `src/lib/review.ts` instead.
 */
export async function critiqueGptResponse(
  params: { gptResponse: string },
  plan: 'free' | 'pro' = 'free'
): Promise<{ critique: string }> {
  const { gptResponse } = params;

  // In this case, there is no Gemini answer.
  // We'll have Multa act as a quality reviewer for the GPT response.
  const prompt = `You are Multa, an expert AI reviewer.
You will critically review the following GPT answer for clarity, correctness, and practicality.
Point out strengths, weaknesses, and possible improvements.

GPT answer:
${gptResponse}`;

  const critique = await callMultaAgent(
    {
      question: 'Please critique the GPT answer above.',
      gptAnswer: gptResponse,
      geminiAnswer: '', // No Gemini answer available for this flow
    },
    plan
  );

  return { critique };
}
