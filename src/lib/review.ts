
'use server';

import type { ChatMessage } from './types';
import { callGeminiAgent } from './agents';

export async function reviewGptWithGemini(
  history: ChatMessage[],
  plan: 'free' | 'pro' = 'free'
): Promise<ChatMessage> {
  const reversed = [...history].reverse();
  const lastUser = reversed.find(m => m.author === 'user');
  const lastGpt = reversed.find(m => m.author === 'gpt');
  const lastGemini = reversed.find(m => m.author === 'gemini');

  if (!lastUser || !lastGpt) {
    return {
      id: `gemini-review-error-${Date.now()}`,
      author: 'gemini' as const,
      content: 'I cannot find the last GPT answer to review.'
    };
  }

  const prompt = `
You are **Gemini**, reviewing GPT's latest answer.

# Original question from the user
${lastUser.content}

# GPT's answer
${lastGpt.content}

# Your own previous answer (Gemini)
${lastGemini ? lastGemini.content : '_No previous Gemini answer was found in this thread._'}

## Task
1. Compare GPT's answer with your own answer.
2. Point out what GPT did well, where it may be wrong or incomplete, and any risks of misunderstanding.
3. Then provide the *best possible* concise final answer for the user, clearly structured.

Write your response in Thai if the conversation is in Thai, otherwise follow the user language.
`.trim();

  const reviewText = await callGeminiAgent(prompt, plan);

  return {
    id: `gemini-review-${Date.now()}`,
    author: 'gemini' as const,
    content: reviewText
  };
}
