'use client';

import type { FormEvent, Dispatch, SetStateAction } from 'react';
import { SendHorizonal, Bot, Scan, FileQuestion } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatInputProps {
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  onSendMessage: (e: FormEvent) => void;
  isTyping: boolean;
}

export default function ChatInput({ input, setInput, onSendMessage, isTyping }: ChatInputProps) {

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e as unknown as FormEvent);
    }
  };

  const quickActions = [
    { command: '/gpt ', label: 'Ask GPT', icon: <Bot className="size-4" /> },
    { command: '/gemini ', label: 'Ask Gemini', icon: <Bot className="size-4" /> },
    { command: '/review', label: 'Review GPT', icon: <Scan className="size-4" /> },
    { command: '/summarize', label: 'Summarize', icon: <FileQuestion className="size-4" /> },
  ];

  return (
    <form onSubmit={onSendMessage} className="space-y-2">
      <div className="flex items-start gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message or use a slash command..."
          className="flex-1 resize-none bg-card border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
          rows={1}
          disabled={isTyping}
        />
        <Button type="submit" size="icon" variant="ghost" disabled={!input.trim() || isTyping}>
          <SendHorizonal className="size-5" />
          <span className="sr-only">Send</span>
        </Button>
      </div>
       <div className="flex items-center gap-2">
         <TooltipProvider>
            {quickActions.map(action => (
                <Tooltip key={action.label}>
                    <TooltipTrigger asChild>
                        <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="text-muted-foreground gap-2"
                            onClick={() => setInput(action.command)}
                            disabled={isTyping}
                        >
                            {action.icon}
                            <span className="hidden md:inline">{action.label}</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{action.label} ({action.command.trim()})</p>
                    </TooltipContent>
                </Tooltip>
            ))}
        </TooltipProvider>
       </div>
    </form>
  );
}
