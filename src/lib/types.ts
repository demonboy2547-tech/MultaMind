export type Agent = 'user' | 'gpt' | 'gemini' | 'multa';

export interface ChatMessage {
  id: string;
  author: Agent;
  content: string;
  isTyping?: boolean;
  createdAt?: number | { seconds: number; nanoseconds: number }; // Allow both for transition
}

export interface Chat {
    id: string;
    userId?: string; // Optional for guest chats
    title: string;
    createdAt: number; // Use number for timestamp
    updatedAt?: number; // Use number for timestamp
    chatMemory?: string;
    pinned?: boolean;
}

export interface GuestChat {
    id: string;
    title: string;
    updatedAt: number; // Use number for timestamp
    messages: ChatMessage[];
    pinned?: boolean;
}

export interface ChatIndexItem {
    id:string;
    title:string;
    updatedAt: number;
    pinned?: boolean;
}
