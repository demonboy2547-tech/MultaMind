'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
import type { ChatMessage, ChatIndexItem } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';

interface ChatContextType {
  chats: ChatIndexItem[];
  activeChatId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isMessagesLoading: boolean;
  setActiveChatId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  createNewChat: () => void;
  saveNewChat: (chatId: string, title: string, messages: ChatMessage[]) => void;
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

  const { data: firestoreChats, isLoading: isChatsLoading } = useCollection<ChatIndexItem>(chatsQuery);

  // Effect to load chats from Firestore or localStorage
  useEffect(() => {
    if (user && firestoreChats) {
      const sortedChats = [...firestoreChats].sort((a, b) => b.updatedAt - a.updatedAt);
      setChats(sortedChats);
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
         // Check if this is a draft chat (not in the list yet)
        if (!chats.some(chat => chat.id === activeChatId)) {
          setMessages([]);
          setMessagesLoading(false);
          return;
        }

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
  }, [activeChatId, user, chats]);
  
  // Effect to set initial active chat, or create a draft if none exists
  useEffect(() => {
      if (isChatsLoading) return; // Wait until chats are loaded
      
      if (chats.length > 0 && !activeChatId) {
          setActiveChatIdState(chats[0].id);
      } else if (chats.length === 0 && !activeChatId) {
          createNewChat();
      }
  }, [chats, activeChatId, isChatsLoading]);


  const setActiveChatId = (id: string | null) => {
    setMessages([]); // Clear messages immediately on chat switch
    setActiveChatIdState(id);
  };

  const createNewChat = useCallback(() => {
    const newChatId = user ? doc(collection(firestore!, 'chats')).id : `guest-${Date.now()}`;
    setActiveChatId(newChatId);
    setMessages([]);
  }, [user, firestore]);

  const saveNewChat = useCallback(async (chatId: string, title: string, updatedMessages: ChatMessage[]) => {
      // If chat already exists, do nothing (or update updatedAt, but this function is for saving NEW chats)
      if (chats.some(chat => chat.id === chatId)) {
        // This is where you might update `updatedAt` for existing chats,
        // but the current logic is focused on saving the initial draft.
        return;
      }

      if (user && firestore) {
          try {
              const batch = writeBatch(firestore);
              
              // 1. Create the main chat document
              const chatRef = doc(firestore, 'chats', chatId);
              batch.set(chatRef, {
                  userId: user.uid,
                  title: title,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
              });

              // 2. Add all messages to the messages subcollection
              updatedMessages.forEach(message => {
                  const messageRef = doc(collection(firestore, 'chats', chatId, 'messages'));
                  batch.set(messageRef, {
                      ...message,
                      createdAt: serverTimestamp() // Use server timestamp for consistency
                  });
              });

              await batch.commit();
              // The useCollection hook will automatically pick up the new chat.
          } catch (error) {
              console.error("Error saving new chat and messages to Firestore:", error);
          }
      } else { // Guest user
          const newChatIndex: ChatIndexItem = { id: chatId, title, updatedAt: Date.now() };
          const updatedChats = [newChatIndex, ...chats];
          updatedChats.sort((a, b) => b.updatedAt - a.updatedAt);
          
          setChats(updatedChats);
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
          localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
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
    saveNewChat,
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
