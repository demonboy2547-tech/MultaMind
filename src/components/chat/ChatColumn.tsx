'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/types';
import MessageBubble from './MessageBubble';

interface ChatColumnProps {
  title: string;
  messages: ChatMessage[];
  isTyping: boolean;
}

export default function ChatColumn({ title, messages, isTyping }: ChatColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div ref={scrollRef} className="h-full flex flex-col overflow-y-auto p-4 space-y-4 bg-background">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isTyping && <MessageBubble message={{ id: `typing-${title}`, agent: title.toLowerCase() as 'gpt' | 'gemini', text: '', isTyping: true }} />}
    </div>
  );
}
