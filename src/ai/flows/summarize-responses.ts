'use server';
// src/ai/flows/summarize-responses.ts
import { callMultaAgent } from '@/lib/agents';

export async function summarizeResponses(
  params: {
    gptResponse: string;
    geminiResponse: string;
  },
  plan: 'free' | 'pro' = 'free'
): Promise<{ summary: string }> {
  const { gptResponse, geminiResponse } = params;

  const summary = await callMultaAgent(
    {
      question:
        'Summarize and compare the two answers below. Focus on the most useful points for the user.',
      gptAnswer: gptResponse,
      geminiAnswer: geminiResponse,
    },
    plan
  );

  return { summary };
}
