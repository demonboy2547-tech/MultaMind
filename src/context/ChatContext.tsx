'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import type { Chat, ChatMessage, ChatIndexItem } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';

interface ChatContextType {
  chats: ChatIndexItem[];
  activeChatId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isMessagesLoading: boolean;
  setActiveChatId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  createNewChat: () => Promise<void>;
  saveMessages: (chatId: string, messages: ChatMessage[]) => void;
  updateChatTitle: (chatId: string, title: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

async function getHeaders() {
    const authModule = await import('firebase/auth');
    const auth = authModule.getAuth();
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

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [chats, setChats] = useState<ChatIndexItem[]>([]);
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMessagesLoading, setMessagesLoading] = useState(false);

  // Firestore query for authenticated user's chats
  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'chats'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: firestoreChats, isLoading: isChatsLoading } = useCollection<Chat>(chatsQuery);

  // Effect to load chats from Firestore or localStorage
  useEffect(() => {
    if (user && firestoreChats) {
      const sortedChats = [...firestoreChats].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      setChats(sortedChats.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt || c.createdAt })));
    } else if (!user) {
      const storedChats = localStorage.getItem('guestChatsIndex');
      if (storedChats) {
        const parsedChats: ChatIndexItem[] = JSON.parse(storedChats);
        parsedChats.sort((a, b) => b.updatedAt - a.updatedAt);
        setChats(parsedChats);
      } else {
        setChats([]);
      }
    }
  }, [user, firestoreChats]);
  
  // Effect to load messages when activeChatId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }

      setMessagesLoading(true);
      if (user) {
        try {
            const headers = await getHeaders();
            const response = await fetch(`/api/chats/${activeChatId}/messages`, { headers });
            if (response.ok) {
              const loadedMessages = await response.json();
              setMessages(loadedMessages);
            } else {
              setMessages([]);
            }
        } catch (error) {
            console.error("Failed to fetch messages:", error);
            setMessages([]);
        }
      } else { // Guest user
        const storedMessages = localStorage.getItem(`guestChat:${activeChatId}`);
        setMessages(storedMessages ? JSON.parse(storedMessages) : []);
      }
      setMessagesLoading(false);
    };
    loadMessages();
  }, [activeChatId, user]);
  
  // Effect to set initial active chat
  useEffect(() => {
      if (!activeChatId && chats.length > 0) {
          setActiveChatIdState(chats[0].id);
      } else if (!activeChatId && chats.length === 0 && !isChatsLoading) {
          createNewChat();
      }
  }, [chats, activeChatId, isChatsLoading]);


  const setActiveChatId = (id: string | null) => {
    setMessages([]); // Clear messages immediately on chat switch
    setActiveChatIdState(id);
  };

  const createNewChat = useCallback(async () => {
    if (user && firestore) {
      const newChatRef = await addDoc(collection(firestore, 'chats'), {
        userId: user.uid,
        title: 'New Chat',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // The useCollection hook will pick up the new chat
      setActiveChatId(newChatRef.id);
    } else {
      const newChatId = `guest-${Date.now()}`;
      const newChat: ChatIndexItem = { id: newChatId, title: 'New Chat', updatedAt: Date.now() };

      setChats(prev => [newChat, ...prev]);
      localStorage.setItem('guestChatsIndex', JSON.stringify([newChat, ...chats]));
      localStorage.setItem(`guestChat:${newChatId}`, JSON.stringify([]));
      setActiveChatId(newChatId);
    }
  }, [user, firestore, chats]);

  const saveMessages = useCallback(async (chatId: string, updatedMessages: ChatMessage[]) => {
    if (user && firestore) {
      // For logged-in users, messages are saved one by one via API
      const lastMessage = updatedMessages[updatedMessages.length - 1];
       if (lastMessage.author !== 'user') { // Only save AI responses
          const headers = await getHeaders();
          await fetch(`/api/chats/${chatId}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(lastMessage),
          });
       } else {
          // User message is already saved via handleSendMessage
       }
       const chatRef = doc(firestore, 'chats', chatId);
       await updateDoc(chatRef, { updatedAt: serverTimestamp() });
    } else {
      localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
    }
  }, [user, firestore]);
  
  const updateChatTitle = useCallback(async (chatId: string, title: string) => {
      const chatToUpdate = chats.find(c => c.id === chatId);
      if (chatToUpdate && chatToUpdate.title === "New Chat") {
          if (user && firestore) {
              const chatRef = doc(firestore, 'chats', chatId);
              await updateDoc(chatRef, { title });
          } else {
              const updatedChats = chats.map(c => c.id === chatId ? { ...c, title, updatedAt: Date.now() } : c);
              updatedChats.sort((a, b) => b.updatedAt - a.updatedAt);
              setChats(updatedChats);
              localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
          }
      }
  }, [user, firestore, chats]);


  const value = {
    chats,
    activeChatId,
    messages,
    isLoading: isChatsLoading,
    isMessagesLoading,
    setActiveChatId,
    setMessages,
    createNewChat,
    saveMessages,
    updateChatTitle,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
