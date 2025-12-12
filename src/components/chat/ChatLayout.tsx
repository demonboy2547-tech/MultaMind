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
import { useAuth, useUser } from '@/firebase';

interface ChatLayoutProps {
  plan: 'free' | 'pro';
  activeChatId: string | null;
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

export default function ChatLayout({ plan, activeChatId }: ChatLayoutProps) {
  const { user } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGptTyping, setGptTyping] = useState(false);
  const [isGeminiTyping, setGeminiTyping] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChatId) return;

      if (user) {
        const headers = await getHeaders();
        const response = await fetch(`/api/chats/${activeChatId}/messages`, { headers });
        if (response.ok) {
          const loadedMessages = await response.json();
          setMessages(loadedMessages);
        } else {
          setMessages([]);
        }
      } else { // Guest user
        const storedMessages = localStorage.getItem(`guestChat:${activeChatId}`);
        setMessages(storedMessages ? JSON.parse(storedMessages) : []);
      }
    };
    loadMessages();
  }, [activeChatId, user]);

  const saveMessages = async (updatedMessages: ChatMessage[]) => {
    if (!activeChatId) return;

    if (!user) { // Guest user
      localStorage.setItem(`guestChat:${activeChatId}`, JSON.stringify(updatedMessages));
      const firstUserMessage = updatedMessages.find(m => m.author === 'user');
      if (updatedMessages.length === 1 && firstUserMessage) {
        const newTitle = firstUserMessage.content.substring(0, 40);
        const indexStr = localStorage.getItem('guestChatsIndex') || '[]';
        const index = JSON.parse(indexStr);
        const chatIndex = index.findIndex((c: { id: string }) => c.id === activeChatId);
        if (chatIndex !== -1) {
          index[chatIndex].title = newTitle;
          index[chatIndex].updatedAt = Date.now();
          localStorage.setItem('guestChatsIndex', JSON.stringify(index));
        }
      } else {
        const indexStr = localStorage.getItem('guestChatsIndex') || '[]';
        const index = JSON.parse(indexStr);
        const chatIndex = index.findIndex((c: { id: string }) => c.id === activeChatId);
        if (chatIndex !== -1) {
          index[chatIndex].updatedAt = Date.now();
          localStorage.setItem('guestChatsIndex', JSON.stringify(index));
        }
      }
    }
  };

  const postMessage = async (message: Omit<ChatMessage, 'id' | 'isTyping'>) => {
    if (user && activeChatId) {
      const headers = await getHeaders();
      await fetch(`/api/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
      });
    }
  };

  const appendAndSave = (newMessage: ChatMessage) => {
    setMessages(prev => {
      const updated = [...prev, newMessage];
      saveMessages(updated);
      return updated;
    });
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText || !activeChatId) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: 'user', content: messageText };
    appendAndSave(userMessage);
    if (user) {
      postMessage(userMessage);
    }
    
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
        appendAndSave(gptMessage);
        if (user) postMessage(gptMessage);
        setGptTyping(false);
        break;
      case '/gemini':
        setGeminiTyping(true);
        const geminiResponse = await callGeminiAgent(rest, plan);
        const geminiMessage = { id: `gemini-${Date.now()}`, author: 'gemini' as const, content: geminiResponse };
        appendAndSave(geminiMessage);
        if (user) postMessage(geminiMessage);
        setGeminiTyping(false);
        break;
      case '/review':
        if (rest.toLowerCase() === 'gemini') {
          setGptTyping(true);
          try {
            const reviewMessage = await reviewGeminiWithGpt(messages, plan);
            const gptReviewMessage = { ...reviewMessage, id: `gpt-review-${Date.now()}` };
            appendAndSave(gptReviewMessage);
            if (user) postMessage(gptReviewMessage);
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
            if (user) postMessage(geminiReviewMessage);
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
            if (user) postMessage(summaryMessage);
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
      saveMessages(updated);
      return updated;
    });

    if (user) {
      postMessage(gptMessage);
      postMessage(geminiMessage);
    }
    
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
