export type Agent = 'user' | 'gpt' | 'gemini' | 'system';

export interface ChatMessage {
  id: string;
  agent: Agent;
  text: string;
  isTyping?: boolean;
}
