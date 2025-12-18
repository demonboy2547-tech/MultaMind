import type { ChatMessage } from './types';
import { callGeminiAgent, callGptAgent } from './agents';

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


export async function reviewGeminiWithGpt(
  history: ChatMessage[],
  plan: 'free' | 'pro' = 'free'
): Promise<ChatMessage> {
  const reversed = [...history].reverse();
  const lastUser = reversed.find(m => m.author === 'user');
  const lastGemini = reversed.find(m => m.author === 'gemini');
  const lastGpt = reversed.find(m => m.author === 'gpt');

  if (!lastGemini || !lastUser) {
    return {
      id: `gpt-review-error-${Date.now()}`,
      author: 'gpt' as const,
      content: 'I cannot find the last Gemini answer to review.'
    };
  }

  const prompt = `
You are **GPT**, reviewing Gemini's latest answer.
Speak in first person as GPT, not as a neutral moderator.

# Original question from the user:
${lastUser.content}

# Gemini's answer:
${lastGemini.content}

# Your own previous answer (GPT):
${lastGpt ? lastGpt.content : '_No previous GPT answer was found in this thread._'}

## Instructions

1. Use the **same language** as the original question above.
   - If the question is in English, answer fully in English.
   - If the question is in Thai, answer fully in Thai.
   - Do NOT mix languages unless the user did.

2. Write as **GPT yourself**, using "I" (or ผม/ฉัน in Thai) when referring to your own reasoning.
   - Do NOT talk about GPT in third person.
   - Example of what to avoid: "GPT thinks that..."
   - Example of what to do: "In my view as GPT, I think..."

3. Structure your response into three short sections:

### 1. Comparison
Briefly compare Gemini's answer with mine:
- Where do we agree?
- Where do we differ?

### 2. Critique of Gemini
Point out:
- What Gemini did well.
- Where Gemini might be incomplete, unclear, or potentially misleading.

### 3. Final answer for you
Give the **best possible final answer for the user**, clearly structured and concise.

Keep the tone friendly, direct, and practical.
`.trim();

  const reviewText = await callGptAgent(prompt, plan);

  return {
    id: `gpt-review-${Date.now()}`,
    author: 'gpt' as const,
    content: reviewText
  };
}
