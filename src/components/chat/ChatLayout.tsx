'use client';

import { useState, useMemo } from 'react';
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

interface ChatLayoutProps {
  plan: 'free' | 'pro';
}

// Helper to convert Firestore Timestamps to numbers
const serializeMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return messages.map(msg => {
    const newMsg = { ...msg };
    if (typeof msg.createdAt === 'object' && msg.createdAt && 'seconds' in msg.createdAt) {
      newMsg.createdAt = (msg.createdAt as any).seconds * 1000;
    }
    return newMsg;
  });
};


export default function ChatLayout({ plan }: ChatLayoutProps) {
  const { 
    activeChatId, 
    messages, 
    setMessages, 
    saveNewChat
  } = useChat();

  const [input, setInput] = useState('');
  const [isGptTyping, setGptTyping] = useState(false);
  const [isGeminiTyping, setGeminiTyping] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // A helper function to manage saving messages and chat creation
  const handleSave = (newMessages: ChatMessage[]) => {
    if (activeChatId) {
        // This is the first user message in a new chat.
        saveNewChat(activeChatId, newMessages[0].content.substring(0, 40), newMessages);
    }
  };


  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    const messageText = input.trim();
    if (!messageText || !activeChatId) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, author: 'user', content: messageText, createdAt: Date.now() };
    
    // Optimistically update the UI with the user's message
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    setInput('');

    const [command, ...args] = messageText.split(' ');
    
    if (command.startsWith('/')) {
      // Slash commands are handled differently and might not persist in the same way.
      // For now, they won't trigger the save of a new chat.
      await handleSlashCommand(command, args.join(' '));
    } else {
      // This is a standard message, so we'll get responses from both agents.
      await handleDualAgentQuery(messageText, newMessages);
    }
  };

  const appendAndSave = (newMessage: ChatMessage, allMessages: ChatMessage[]) => {
    const updatedMessages = [...allMessages, newMessage];
    setMessages(updatedMessages);
    if(activeChatId) {
      saveNewChat(activeChatId, updatedMessages[0].content.substring(0, 40), updatedMessages);
    }
  }


  const handleSlashCommand = async (command: string, rest: string) => {
    if (!activeChatId) return;
    // Note: Slash commands will add to messages, but won't trigger a new chat save.
    // This could be changed if needed.
    const currentMessages = messages;
    
    switch (command) {
      case '/gpt':
        setGptTyping(true);
        const gptResponse = await callGptAgent(rest, plan);
        const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse, createdAt: Date.now() };
        appendAndSave(gptMessage, [...currentMessages, {id: `user-cmd-${Date.now()}`, author: 'user', content: `${command} ${rest}`, createdAt: Date.now()}]);
        setGptTyping(false);
        break;
      case '/gemini':
        setGeminiTyping(true);
        const geminiResponse = await callGeminiAgent(rest, plan);
        const geminiMessage = { id: `gemini-${Date.now()}`, author: 'gemini' as const, content: geminiResponse, createdAt: Date.now() };
        appendAndSave(geminiMessage, [...currentMessages, {id: `user-cmd-${Date.now()}`, author: 'user', content: `${command} ${rest}`, createdAt: Date.now()}]);
        setGeminiTyping(false);
        break;
      case '/review':
        const plainMessages = serializeMessages(messages);
        if (rest.toLowerCase() === 'gemini') {
          setGptTyping(true);
          try {
            const reviewMessage = await reviewGeminiWithGpt(plainMessages, plan);
            const gptReviewMessage = { ...reviewMessage, id: `gpt-review-${Date.now()}` };
            appendAndSave(gptReviewMessage, currentMessages);
          } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to get review from GPT." });
          } finally {
            setGptTyping(false);
          }
        } else { // Default to reviewing GPT
          setGeminiTyping(true);
          try {
            const reviewMessage = await reviewGptWithGemini(plainMessages, plan);
            const geminiReviewMessage = { ...reviewMessage, id: `gemini-review-${Date.now()}` };
            appendAndSave(geminiReviewMessage, currentMessages);
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
          const typingMessage = { id: `multa-typing-${Date.now()}`, author: 'multa' as const, content: 'Summarizing...', isTyping: true, createdAt: Date.now() };
          setMessages(prev => [...prev, typingMessage]);
          try {
            const result = await summarizeResponses({ gptResponse: lastGpt.content, geminiResponse: lastGemini.content }, plan);
            const summaryMessage = { id: `summary-${Date.now()}`, author: 'multa' as const, content: `**Summary of last responses:**\n\n${result.summary}`, createdAt: Date.now() };
            setMessages(prev => [...prev.filter(m => m.id !== typingMessage.id), summaryMessage]);
             if(activeChatId) {
                saveNewChat(activeChatId, messages[0].content.substring(0, 40), [...messages, summaryMessage]);
             }
          } catch (error) {
            setMessages(prev => prev.filter(m => m.id !== typingMessage.id));
            toast({ variant: "destructive", title: "Error", description: "Failed to summarize." });
          }
        } else {
          const multaMessage = { id: `multa-${Date.now()}`, author: 'multa' as const, content: "A response from both GPT and Gemini is needed to summarize.", createdAt: Date.now() };
          appendAndSave(multaMessage, currentMessages);
        }
        break;
      default:
        const unknownCmdMessage = { id: `multa-${Date.now()}`, author: 'multa' as const, content: `Unknown command: ${command}`, createdAt: Date.now() };
        appendAndSave(unknownCmdMessage, currentMessages);
    }
  };

  const handleDualAgentQuery = async (messageText: string, currentMessages: ChatMessage[]) => {
    if (!activeChatId) return;

    setGptTyping(true);
    setGeminiTyping(true);
    
    const [gptResponse, geminiResponse] = await Promise.all([
      callGptAgent(messageText, plan),
      callGeminiAgent(messageText, plan)
    ]);

    setGptTyping(false);
    setGeminiTyping(false);

    const gptMessage = { id: `gpt-${Date.now()}`, author: 'gpt' as const, content: gptResponse, createdAt: Date.now() };
    const geminiMessage = { id: `gemini-${Date.now() + 1}`, author: 'gemini' as const, content: geminiResponse, createdAt: Date.now() };

    const finalMessages = [...currentMessages, gptMessage, geminiMessage];
    setMessages(finalMessages);
    
    // After getting the first AI replies, save the new chat.
    handleSave(finalMessages);
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
