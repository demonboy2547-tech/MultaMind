'use client';

import { useState, useMemo, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/ui/Logo';
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage, Agent } from '@/lib/types';
import { callGptAgent, callGeminiAgent } from '@/lib/agents';
import { summarizeResponses } from '@/ai/flows/summarize-responses';
import { reviewGptWithGemini, reviewGeminiWithGpt } from '@/lib/review';
import ChatColumn from './ChatColumn';
import ChatInput from './ChatInput';
import { useAuth, useUser } from '@/firebase';

interface ChatLayoutProps {
  plan: 'free' | 'pro';
}

async function getHeaders() {
  const auth = useAuth();
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }
  return { 'Content-Type': 'application/json' };
}

export default function ChatLayout({ plan }: ChatLayoutProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGptTyping, setGptTyping] = useState(false);
  const [isGeminiTyping, setGeminiTyping] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  useEffect(() => {
    const createNewChat = async () => {
      if (user) {
        const headers = await getHeaders();
        const response = await fetch('/api/chats', {
          method: 'POST',
          headers,
          body: JSON.stringify({ title: 'New Chat' }),
        });
        if (response.ok) {
          const newChat = await response.json();
          setActiveChatId(newChat.id);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to create a new chat." });
        }
      }
    };
    if (user && !activeChatId) {
      // For simplicity, we create a new chat every time the component mounts for a logged-in user
      // A more robust implementation would list existing chats and allow selection.
      createNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const postMessage = async (message: Omit<ChatMessage, 'id'>) => {
    if (user && activeChatId) {
      const headers = await getHeaders();
      await fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });
    }
  };


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    postMessage(userMessage);
    setInput('');

    const [command, ...args] = messageText.split(' ');

    if (command.startsWith('/')) {
      await handleSlashCommand(command, args.join(' '));
    } else {
      await handleDualAgentQuery(messageText);
    }
  };

  const handleSlashCommand = async (command: string, rest: string) => {
    switch (command) {
      case '/gpt':
        setGptTyping(true);
        const gptResponse = await callGptAgent(rest, plan);
        const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse };
        setMessages(prev => [...prev, gptMessage]);
        postMessage(gptMessage);
        setGptTyping(false);
        break;
      case '/gemini':
        setGeminiTyping(true);
        const geminiResponse = await callGeminiAgent(rest, plan);
        const geminiMessage = { id: `gemini-${Date.now()}`, author: 'gemini' as const, content: geminiResponse };
        setMessages(prev => [...prev, geminiMessage]);
        postMessage(geminiMessage);
        setGeminiTyping(false);
        break;
      case '/review':
        if (rest.toLowerCase() === 'gemini') {
          setGptTyping(true);
          try {
            const reviewMessage = await reviewGeminiWithGpt(messages, plan);
            const gptReviewMessage = { ...reviewMessage, id: `gpt-review-${Date.now()}` };
            setMessages(prev => [...prev, gptReviewMessage]);
            postMessage(gptReviewMessage);
          } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to get review from GPT." });
          } finally {
            setGptTyping(false);
          }
        } else { // Default to reviewing GPT
          setGeminiTyping(true);
          try {
            const reviewMessage = await reviewGptWithGemini(messages, plan);
            const geminiReviewMessage = { ...reviewMessage, id: `gemini-review-${Date.now()}` };
            setMessages(prev => [...prev, geminiReviewMessage]);
            postMessage(geminiReviewMessage);
          } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to get review from Gemini." });
          } finally {
            setGeminiTyping(false);
          }
        }
        break;
      case '/summarize':
        const lastGpt = [...messages].reverse().find(m => m.author === 'gpt');
        const lastGemini = [...messages].reverse().find(m => m.author === 'gemini');
        if (lastGpt && lastGemini) {
          setMessages(prev => [...prev, { id: `multa-typing-${Date.now()}`, author: 'multa', content: 'Summarizing...', isTyping: true }]);
          try {
             // @ts-ignore - plan is passed to the flow but not explicitly typed in the function signature for now
            const result = await summarizeResponses({ gptResponse: lastGpt.content, geminiResponse: lastGemini.content }, plan);
            setMessages(prev => prev.filter(m => m.id !== `multa-typing-${Date.now()}`));
            const summaryMessage = { id: `summary-${Date.now()}`, author: 'multa' as const, content: `**Summary of last responses:**\n\n${result.summary}` };
            setMessages(prev => [...prev, summaryMessage]);
            postMessage(summaryMessage);
          } catch (error) {
            setMessages(prev => prev.filter(m => m.id !== `multa-typing-${Date.now()}`));
            toast({ variant: "destructive", title: "Error", description: "Failed to summarize." });
          }
        } else {
          setMessages(prev => [...prev, { id: `multa-${Date.now()}`, author: 'multa', content: "A response from both GPT and Gemini is needed to summarize." }]);
        }
        break;
      default:
        setMessages(prev => [...prev, { id: `multa-${Date.now()}`, author: 'multa', content: `Unknown command: ${command}` }]);
    }
  };

  const handleDualAgentQuery = async (messageText: string) => {
    setGptTyping(true);
    setGeminiTyping(true);
    
    const [gptResponse, geminiResponse] = await Promise.all([
      callGptAgent(messageText, plan),
      callGeminiAgent(messageText, plan)
    ]);

    const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse };
    const geminiMessage = { id: `gemini-${Date.now() + 1}`, author: 'gemini' as const, content: geminiResponse };

    setMessages(prev => [
      ...prev,
      gptMessage,
      geminiMessage
    ]);
    
    postMessage(gptMessage);
    postMessage(geminiMessage);
    
    setGptTyping(false);
    setGeminiTyping(false);
  };
  
  const filterMessages = (agent: Agent) => messages.filter(m => m.author === agent || m.author === 'user' || m.author === 'multa');
  
  const gptMessages = useMemo(() => filterMessages('gpt'), [messages]);
  const geminiMessages = useMemo(() => filterMessages('gemini'), [messages]);

  const renderColumns = () => (
    <>
      <ChatColumn title="GPT" messages={gptMessages} isTyping={isGptTyping} />
      <Separator orientation={isMobile ? 'horizontal' : 'vertical'} />
      <ChatColumn title="Gemini" messages={geminiMessages} isTyping={isGeminiTyping} />
    </>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground">      
      <main className="flex-1 overflow-hidden">
        {isMobile ? (
          <Tabs defaultValue="gpt" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 bg-card rounded-none border-b">
              <TabsTrigger value="gpt">GPT</TabsTrigger>
              <TabsTrigger value="gemini">Gemini</TabsTrigger>
            </TabsList>
            <TabsContent value="gpt" className="flex-1 overflow-y-auto mt-0">
               <ChatColumn title="GPT" messages={gptMessages} isTyping={isGptTyping} />
            </TabsContent>
            <TabsContent value="gemini" className="flex-1 overflow-y-auto mt-0">
               <ChatColumn title="Gemini" messages={geminiMessages} isTyping={isGeminiTyping} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] h-full">
            {renderColumns()}
          </div>
        )}
      </main>

      <footer className="p-4 bg-background">
        <Card className="p-2">
            <ChatInput 
                input={input} 
                setInput={setInput} 
                onSendMessage={handleSendMessage}
                isTyping={isGptTyping || isGeminiTyping}
            />
        </Card>
      </footer>
    </div>
  );
}
