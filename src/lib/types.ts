export type Agent = 'user' | 'gpt' | 'gemini' | 'multa';

export interface ChatMessage {
  id: string;
  author: Agent;
  content: string;
  isTyping?: boolean;
}

export interface Chat {
    id: string;
    userId: string;
    title: string;
    createdAt: number; // Use number for timestamp
    chatMemory?: string;
}

export interface GuestChat {
    id: string;
    title: string;
    updatedAt: number; // Use number for timestamp
    messages: ChatMessage[];
}
