'use server';

import {ai} from '@/ai/genkit';
import {MODELS} from './models';
import type {GenerateRequest} from 'genkit';

async function callAgent(
  model: GenerateRequest['model'],
  message: string
): Promise<string> {
  const {text} = await ai.generate({
    model,
    prompt: message,
  });
  return text;
}

export async function callGptAgent(message: string): Promise<string> {
  return callAgent(MODELS.gpt, message);
}

export async function callGeminiAgent(message: string): Promise<string> {
  return callAgent(MODELS.gemini, message);
}
