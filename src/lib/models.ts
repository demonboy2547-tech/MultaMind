import {googleAI} from '@genkit-ai/google-genai';

export const MODELS = {
  gpt: googleAI.model('gemini-1.5-flash'),      // Using a Gemini model for the "GPT" side for stability
  gemini: googleAI.model('gemini-1.5-pro'),     // used as the “Gemini side”
  multa: googleAI.model('gemini-1.5-flash'),    // used for moderation / summary
};
