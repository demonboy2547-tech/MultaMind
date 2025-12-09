import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { Bot, User, BrainCircuit } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
}

const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-2">
        <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></span>
    </div>
);

const agentStyles = {
    user: {
      container: 'items-end',
      bubble: 'bg-primary text-primary-foreground rounded-br-none',
      icon: <User className="size-5 flex-shrink-0" />,
    },
    gpt: {
      container: 'items-start',
      bubble: 'bg-card rounded-bl-none',
      icon: <Bot className="size-5 flex-shrink-0" />,
    },
    gemini: {
      container: 'items-start',
      bubble: 'bg-card rounded-bl-none',
      icon: <Bot className="size-5 flex-shrink-0 text-foreground" />,
    },
    system: {
      container: 'items-center',
      bubble: 'bg-transparent text-muted-foreground border border-dashed text-xs',
      icon: <BrainCircuit className="size-4 flex-shrink-0 text-muted-foreground" />,
    },
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const { agent, text, isTyping } = message;
  const styles = agentStyles[agent];

  if (agent === 'system') {
    return (
        <div className="flex justify-center items-center gap-2 w-full">
          <div className={cn('max-w-full px-3 py-2 rounded-lg', styles.bubble)}>
            {isTyping ? <TypingIndicator /> : <p className="whitespace-pre-wrap">{text}</p>}
          </div>
        </div>
    )
  }

  return (
    <div className={cn('flex w-full gap-2', styles.container)}>
        {agent !== 'user' && <div className="p-2 rounded-full bg-card self-start">{styles.icon}</div>}
      <div className={cn('max-w-[80%] px-4 py-3 rounded-xl', styles.bubble)}>
        {isTyping ? <TypingIndicator /> : <p className="whitespace-pre-wrap">{text}</p>}
      </div>
      {agent === 'user' && <div className="p-2 rounded-full bg-primary self-start">{styles.icon}</div>}
    </div>
  );
}
