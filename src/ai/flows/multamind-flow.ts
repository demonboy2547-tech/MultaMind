'use server';

import { getModelsForPlan } from '@/lib/plan';
import { HttpClient } from 'genkit/experimental/standalone';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

const openRouterClient = new HttpClient(OPENROUTER_URL, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
    'HTTP-Referer':
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'X-Title': 'MultaMind',
  },
});

type Role = 'system' | 'user' | 'assistant';

export interface AgentMessage {
  role: Role;
  content: string;
}

async function callOpenRouter(
  model: string,
  messages: AgentMessage[]
): Promise<string> {
  const res = await openRouterClient.post('/chat/completions', {
    body: {
      model,
      messages,
    },
    cache: 'no-store',
  });

  return (res?.choices?.[0]?.message?.content as string) ?? '';
}

/**
 * GPT side – Uses the "GPT" model for the selected plan.
 */
export async function callGptAgent(
  message: string,
  plan: 'free' | 'pro' = 'free'
): Promise<string> {
  const MODELS = getModelsForPlan(plan);
  const messages: AgentMessage[] = [
    {
      role: 'user',
      content: message,
    },
  ];
  return callOpenRouter(MODELS.gpt, messages);
}

/**
 * Gemini side – Uses the "Gemini" model for the selected plan.
 */
export async function callGeminiAgent(
  message: string,
  plan: 'free' | 'pro' = 'free'
): Promise<string> {
  const MODELS = getModelsForPlan(plan);
  const messages: AgentMessage[] = [
    {
      role: 'user',
      content: message,
    },
  ];
  return callOpenRouter(MODELS.gemini, messages);
}

/**
 * Multa – The summary/comparison agent. Uses the "Multa" model for the selected plan.
 */
export async function callMultaAgent(
  params: {
    question: string;
    gptAnswer: string;
    geminiAnswer: string;
  },
  plan: 'free' | 'pro' = 'free'
): Promise<string> {
  const MODELS = getModelsForPlan(plan);
  const { question, gptAnswer, geminiAnswer } = params;

  const messages: AgentMessage[] = [
    {
      role: 'system',
      content:
        'You are Multa, a friendly but precise moderator AI. You compare answers from two expert AIs and explain the differences clearly. Answer in Thai if the user writes in Thai, otherwise in English.',
    },
    {
      role: 'user',
      content: `User question:
${question}

Answer A (GPT side):
${gptAnswer}

Answer B (Gemini side):
${geminiAnswer}

1) Summarize key points from both.
2) Explain where they agree and where they disagree.
3) Give a practical recommendation for the user.
Keep it concise and natural, not robotic.`,
    },
  ];

  return callOpenRouter(MODELS.multa, messages);
}


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
