export type Agent = 'user' | 'gpt' | 'gemini' | 'multa';

export interface ChatMessage {
  id: string;
  author: Agent;
  content: string;
  isTyping?: boolean;
}
