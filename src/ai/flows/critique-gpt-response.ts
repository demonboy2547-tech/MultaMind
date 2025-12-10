'use server';

/**
 * @fileOverview A flow that allows the 'multa' agent to critique the last GPT response.
 *
 * - critiqueGptResponse - A function that takes the last GPT response and returns a critique.
 * - CritiqueGptResponseInput - The input type for the critiqueGptResponse function.
 * - CritiqueGptResponseOutput - The return type for the critiqueGptResponse function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {MODELS} from '@/lib/models';

const CritiqueGptResponseInputSchema = z.object({
  gptResponse: z
    .string()
    .describe('The most recent response from the GPT agent.'),
});
export type CritiqueGptResponseInput = z.infer<typeof CritiqueGptResponseInputSchema>;

const CritiqueGptResponseOutputSchema = z.object({
  critique: z
    .string()
    .describe(
      'A critical analysis of the GPT response, highlighting potential flaws, biases, or areas for improvement.'
    ),
});
export type CritiqueGptResponseOutput = z.infer<typeof CritiqueGptResponseOutputSchema>;

export async function critiqueGptResponse(
  input: CritiqueGptResponseInput
): Promise<CritiqueGptResponseOutput> {
  return critiqueGptResponseFlow(input);
}

const prompt = ai.definePrompt({
  name: 'critiqueGptResponsePrompt',
  input: {schema: CritiqueGptResponseInputSchema},
  output: {schema: CritiqueGptResponseOutputSchema},
  prompt: `You are an expert AI assistant specializing in critically analyzing the responses of other AI models.

You will be provided with a response from a language model. Your task is to provide a detailed critique of this response, highlighting any potential flaws, biases, areas for improvement, or factual inaccuracies.

Model Response: {{{gptResponse}}}

Critique:`,
  model: MODELS.multa
});

const critiqueGptResponseFlow = ai.defineFlow(
  {
    name: 'critiqueGptResponseFlow',
    inputSchema: CritiqueGptResponseInputSchema,
    outputSchema: CritiqueGptResponseOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
