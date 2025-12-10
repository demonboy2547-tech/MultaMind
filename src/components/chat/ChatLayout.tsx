'use client';

import { useState, useMemo } from 'react';
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

interface ChatLayoutProps {
  plan: 'free' | 'pro';
}

export default function ChatLayout({ plan }: ChatLayoutProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGptTyping, setGptTyping] = useState(false);
  const [isGeminiTyping, setGeminiTyping] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
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
        setMessages(prev => [...prev, { id: `gpt-${Date.now()}`, author: 'gpt', content: gptResponse }]);
        setGptTyping(false);
        break;
      case '/gemini':
        setGeminiTyping(true);
        const geminiResponse = await callGeminiAgent(rest, plan);
        setMessages(prev => [...prev, { id: `gemini-${Date.now()}`, author: 'gemini', content: geminiResponse }]);
        setGeminiTyping(false);
        break;
      case '/review':
        if (rest.toLowerCase() === 'gemini') {
          setGptTyping(true);
          try {
            const reviewMessage = await reviewGeminiWithGpt(messages, plan);
            setMessages(prev => [...prev, { ...reviewMessage, id: `gpt-review-${Date.now()}` }]);
          } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to get review from GPT." });
          } finally {
            setGptTyping(false);
          }
        } else { // Default to reviewing GPT
          setGeminiTyping(true);
          try {
            const reviewMessage = await reviewGptWithGemini(messages, plan);
            setMessages(prev => [...prev, { ...reviewMessage, id: `gemini-review-${Date.now()}` }]);
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
            setMessages(prev => [...prev, { id: `summary-${Date.now()}`, author: 'multa', content: `**Summary of last responses:**\n\n${result.summary}` }]);
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

    setMessages(prev => [
      ...prev,
      { id: `gpt-${Date.now()}`, author: 'gpt', content: gptResponse },
      { id: `gemini-${Date.now() + 1}`, author: 'gemini', content: geminiResponse }
    ]);
    
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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b">
        <Logo />
      </header>
      
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
