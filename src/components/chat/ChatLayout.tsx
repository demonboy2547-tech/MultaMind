'use client';

import { useState, useMemo, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage, Agent } from '@/lib/types';
import { callGptAgent, callGeminiAgent } from '@/lib/agents';
import { summarizeResponses } from '@/ai/flows/summarize-responses';
import { reviewGptWithGemini, reviewGeminiWithGpt } from '@/lib/review';
import ChatColumn from './ChatColumn';
import ChatInput from './ChatInput';
import { useChat } from '@/context/ChatContext';
import { useUser } from '@/firebase';

interface ChatLayoutProps {
  plan: 'free' | 'pro';
}

export default function ChatLayout({ plan }: ChatLayoutProps) {
  const { user } = useUser();
  const { 
    activeChatId, 
    messages, 
    setMessages, 
    saveMessages,
    updateChatTitle
  } = useChat();

  const [input, setInput] = useState('');
  const [isGptTyping, setGptTyping] = useState(false);
  const [isGeminiTyping, setGeminiTyping] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const appendAndSave = (newMessage: ChatMessage) => {
    setMessages(prev => {
      const updated = [...prev, newMessage];
      if (activeChatId) {
        saveMessages(activeChatId, updated);
        // If this is the first user message, update the title
        if (updated.filter(m => m.author === 'user').length === 1) {
            updateChatTitle(activeChatId, newMessage.content.substring(0, 40));
        }
      }
      return updated;
    });
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText || !activeChatId) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: 'user', content: messageText };
    appendAndSave(userMessage);
    
    setInput('');

    const [command, ...args] = messageText.split(' ');
    
    if (command.startsWith('/')) {
      await handleSlashCommand(command, args.join(' '));
    } else {
      await handleDualAgentQuery(messageText);
    }
  };

  const handleSlashCommand = async (command: string, rest: string) => {
    if (!activeChatId) return;
    switch (command) {
      case '/gpt':
        setGptTyping(true);
        const gptResponse = await callGptAgent(rest, plan);
        const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse };
        appendAndSave(gptMessage);
        setGptTyping(false);
        break;
      case '/gemini':
        setGeminiTyping(true);
        const geminiResponse = await callGeminiAgent(rest, plan);
        const geminiMessage = { id: `gemini-${Date.now()}`, author: 'gemini' as const, content: geminiResponse };
        appendAndSave(geminiMessage);
        setGeminiTyping(false);
        break;
      case '/review':
        if (rest.toLowerCase() === 'gemini') {
          setGptTyping(true);
          try {
            const reviewMessage = await reviewGeminiWithGpt(messages, plan);
            const gptReviewMessage = { ...reviewMessage, id: `gpt-review-${Date.now()}` };
            appendAndSave(gptReviewMessage);
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
            appendAndSave(geminiReviewMessage);
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
          const typingMessage = { id: `multa-typing-${Date.now()}`, author: 'multa' as const, content: 'Summarizing...', isTyping: true };
          appendAndSave(typingMessage);
          try {
            const result = await summarizeResponses({ gptResponse: lastGpt.content, geminiResponse: lastGemini.content }, plan);
            setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
            const summaryMessage = { id: `summary-${Date.now()}`, author: 'multa' as const, content: `**Summary of last responses:**\n\n${result.summary}` };
            appendAndSave(summaryMessage);
          } catch (error) {
            setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
            toast({ variant: "destructive", title: "Error", description: "Failed to summarize." });
          }
        } else {
          const multaMessage = { id: `multa-${Date.now()}`, author: 'multa' as const, content: "A response from both GPT and Gemini is needed to summarize." };
          appendAndSave(multaMessage);
        }
        break;
      default:
        const unknownCmdMessage = { id: `multa-${Date.now()}`, author: 'multa' as const, content: `Unknown command: ${command}` };
        appendAndSave(unknownCmdMessage);
    }
  };

  const handleDualAgentQuery = async (messageText: string) => {
    if (!activeChatId) return;

    setGptTyping(true);
    setGeminiTyping(true);
    
    const [gptResponse, geminiResponse] = await Promise.all([
      callGptAgent(messageText, plan),
      callGeminiAgent(messageText, plan)
    ]);

    const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse };
    const geminiMessage = { id: `gemini-${Date.now() + 1}`, author: 'gemini' as const, content: geminiResponse };

    setMessages(prev => {
      const updated = [...prev, gptMessage, geminiMessage];
       if (activeChatId) {
        saveMessages(activeChatId, updated);
      }
      return updated;
    });
    
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
