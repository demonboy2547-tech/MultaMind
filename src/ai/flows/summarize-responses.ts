'use server';

/**
 * @fileOverview Implements the /multa summarize slash command to generate a concise summary of the most recent responses from both GPT and Gemini.
 *
 * - summarizeResponses - A function that handles the summarization process.
 * - SummarizeResponsesInput - The input type for the summarizeResponses function.
 * - SummarizeResponsesOutput - The return type for the summarizeResponses function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeResponsesInputSchema = z.object({
  gptResponse: z.string().describe('The most recent response from the GPT agent.'),
  geminiResponse: z.string().describe('The most recent response from the Gemini agent.'),
});
export type SummarizeResponsesInput = z.infer<typeof SummarizeResponsesInputSchema>;

const SummarizeResponsesOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the GPT and Gemini responses.'),
});
export type SummarizeResponsesOutput = z.infer<typeof SummarizeResponsesOutputSchema>;

export async function summarizeResponses(input: SummarizeResponsesInput): Promise<SummarizeResponsesOutput> {
  return summarizeResponsesFlow(input);
}

const summarizeResponsesPrompt = ai.definePrompt({
  name: 'summarizeResponsesPrompt',
  input: {schema: SummarizeResponsesInputSchema},
  output: {schema: SummarizeResponsesOutputSchema},
  prompt: `Summarize the key insights from the following GPT and Gemini responses:

GPT Response: {{{gptResponse}}}

Gemini Response: {{{geminiResponse}}}

Provide a concise summary that captures the main points from both responses.`,
});

const summarizeResponsesFlow = ai.defineFlow(
  {
    name: 'summarizeResponsesFlow',
    inputSchema: SummarizeResponsesInputSchema,
    outputSchema: SummarizeResponsesOutputSchema,
  },
  async input => {
    const {output} = await summarizeResponsesPrompt(input);
    return output!;
  }
);
