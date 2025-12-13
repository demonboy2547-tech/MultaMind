'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, updateDoc, doc, writeBatch, Timestamp, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
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
  togglePinChat: (chatId: string) => void;
  renameChat: (chatId: string, newTitle: string) => void;
  deleteChat: (chatId: string) => void;
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

// Stable comparator: pinned first, then most recently updated.
function chatSortComparator(a: ChatIndexItem, b: ChatIndexItem): number {
  if (a.pinned && !b.pinned) return -1;
  if (!a.pinned && b.pinned) return 1;
  const dateA = typeof a.updatedAt === 'number' ? a.updatedAt : (a.updatedAt as any)?.toMillis?.() ?? 0;
  const dateB = typeof b.updatedAt === 'number' ? b.updatedAt : (b.updatedAt as any)?.toMillis?.() ?? 0;
  return dateB - dateA;
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
    // We order by updatedAt on the server, and then apply combined sorting on the client
    return query(collection(firestore, 'chats'), where('userId', '==', user.uid), orderBy('updatedAt', 'desc'));
  }, [user, firestore]);

  const { data: firestoreChats, isLoading: isChatsLoading } = useCollection<ChatIndexItem>(chatsQuery);
  
  // Effect to load chats from Firestore or localStorage
  useEffect(() => {
    if (user && firestoreChats) {
      const formattedChats = firestoreChats.map(c => ({
        ...c,
        // Ensure updatedAt is a number for consistent sorting
        updatedAt: (c.updatedAt as any)?.seconds ? (c.updatedAt as any).seconds * 1000 : c.updatedAt
      }))
      setChats(formattedChats);
    } else if (!user) {
      const storedChats = localStorage.getItem('guestChatsIndex');
      if (storedChats) {
        const parsedChats: ChatIndexItem[] = JSON.parse(storedChats);
        setChats(parsedChats);
      } else {
        setChats([]);
      }
    }
  }, [user, firestoreChats]);
  
  const sortedChats = React.useMemo(() => {
    // Create a new sorted array from the chats state
    return [...chats].sort(chatSortComparator);
  }, [chats]);
  
  // Effect to load messages when activeChatId changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeChatId) {
        setMessages([]);
        return;
      }

      setMessagesLoading(true);
      if (user) {
        // Allow loading messages for draft chats that are not yet in the main list
        const isDraft = !chats.some(chat => chat.id === activeChatId);
        if (isDraft) {
            setMessages([]);
            setMessagesLoading(false);
            return;
        }

        try {
            const headers = await getHeaders();
            const response = await fetch(`/api/chats/${activeChatId}/messages`, { headers });
            if (response.ok) {
              let loadedMessages = await response.json();
              // Convert Firestore Timestamps to JS Dates/numbers if necessary
              loadedMessages = loadedMessages.map((msg: any) => ({
                ...msg,
                createdAt: msg.createdAt?._seconds ? msg.createdAt._seconds * 1000 : new Date(msg.createdAt)
              }));
              setMessages(loadedMessages);
            } else {
              console.error("Failed to fetch messages:", response.statusText);
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
      
      // If there's an active chat already, don't change it.
      if (activeChatId) return;

      if (sortedChats.length > 0) {
          setActiveChatIdState(sortedChats[0].id);
      } else {
          // Creates an initial draft chat on first load if no chats exist
          createNewChat();
      }
  }, [sortedChats, activeChatId, isChatsLoading]);


  const setActiveChatId = (id: string | null) => {
    setMessages([]); // Clear messages immediately on chat switch
    setActiveChatIdState(id);
  };

  const createNewChat = useCallback(() => {
    // This creates a temporary ID. The chat isn't saved until the first message.
    const newChatId = user ? doc(collection(firestore!, 'chats')).id : `guest-${Date.now()}`;
    setActiveChatId(newChatId); // Set as active, which makes it a "draft"
    setMessages([]); // Ensure message area is clear for the new draft
  }, [user, firestore]);

  const saveNewChat = useCallback(async (chatId: string, title: string, updatedMessages: ChatMessage[]) => {
      // If chat already exists in our state, it's not a "new" chat, so we just update messages.
      if (chats.some(chat => chat.id === chatId)) {
        if (user) {
          // This part is tricky because we'd need to fetch existing messages and append.
          // For now, this function is primarily for the FIRST save.
          // A separate `saveMessages` function would be better for subsequent updates.
        } else {
           localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
        }
        return;
      }

      const now = Date.now();
      const newChatIndexItem: ChatIndexItem = { id: chatId, title, updatedAt: now, pinned: false };
      
      if (user && firestore) {
          try {
              const chatRef = doc(firestore, "chats", chatId);
              // Set the main chat document
              await setDoc(chatRef, {
                  userId: user.uid,
                  title: title,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  pinned: false,
              });

              // Batch write all messages
              const batch = writeBatch(firestore);
              updatedMessages.forEach(message => {
                  const messageRef = doc(collection(firestore, 'chats', chatId, 'messages'));
                  const messageData = {
                      ...message,
                      createdAt: Timestamp.fromMillis(now)
                  };
                  batch.set(messageRef, messageData);
              });
              await batch.commit();

              // The useCollection hook will refetch, but we can optimistically update UI
              setChats(prevChats => [newChatIndexItem, ...prevChats]);

          } catch (error) {
              console.error("Error saving new chat to Firestore:", error);
          }
      } else { // Guest user
          const updatedChats = [newChatIndexItem, ...chats];
          setChats(updatedChats);
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
          localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
      }
  }, [user, firestore, chats]);

  const togglePinChat = useCallback(async (chatId: string) => {
    // Optimistic update first
    let nextPinned: boolean | null = null;
    setChats(prev => {
      const target = prev.find(c => c.id === chatId);
      if (!target) return prev;
      nextPinned = !target.pinned;
      const now = Date.now();
      const updated = prev.map(c => c.id === chatId ? { ...c, pinned: nextPinned!, updatedAt: now } : c);
      return updated;
    });

    try {
      if (user && firestore && nextPinned !== null) {
        const chatRef = doc(firestore, 'chats', chatId);
        await updateDoc(chatRef, { pinned: nextPinned, updatedAt: serverTimestamp() });
      } else if (!user) {
        // Persist guest index
        const stored = localStorage.getItem('guestChatsIndex');
        const parsed: ChatIndexItem[] = stored ? JSON.parse(stored) : [];
        const now = Date.now();
        const updated = parsed.map(c => c.id === chatId ? { ...c, pinned: !c.pinned, updatedAt: now } : c);
        localStorage.setItem('guestChatsIndex', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('togglePinChat failed', err);
    }
  }, [user, firestore]);

  const renameChat = useCallback(async (chatId: string, newTitle: string) => {
    // Optimistic UI update
    const now = Date.now();
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle, updatedAt: now } : c));

    try {
      if (user && firestore) {
        const chatRef = doc(firestore, 'chats', chatId);
        await updateDoc(chatRef, { title: newTitle, updatedAt: serverTimestamp() });
      } else {
        const storedChats = localStorage.getItem('guestChatsIndex');
        if (storedChats) {
          const parsedChats: ChatIndexItem[] = JSON.parse(storedChats);
          const updatedChats = parsedChats.map(c =>
            c.id === chatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
          );
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
        }
      }
    } catch (error) {
      console.error('renameChat failed:', error);
    }
  }, [user, firestore]);


  const deleteChat = useCallback(async (chatId: string) => {
    // Compute next active chat deterministically outside setState.
    const currentChats = chats;
    const currentIndex = currentChats.findIndex(c => c.id === chatId);
    const remainingChats = currentChats.filter(c => c.id !== chatId);

    // Optimistically update UI
    setChats(remainingChats);

    // Update active chat (avoid doing this inside setChats updater)
    if (activeChatId === chatId) {
      let nextActiveChatId: string | null = null;
      if (remainingChats.length > 0) {
        const nextIndex = currentIndex < remainingChats.length ? currentIndex : remainingChats.length - 1;
        nextActiveChatId = remainingChats[nextIndex]?.id || null;
      }
      if (nextActiveChatId) {
        setActiveChatId(nextActiveChatId);
      } else {
        createNewChat();
      }
    }

    // Persist
    try {
      if (user && firestore) {
        const chatRef = doc(firestore, 'chats', chatId);
        await deleteDoc(chatRef);
      } else {
        localStorage.removeItem(`guestChat:${chatId}`);
        localStorage.setItem('guestChatsIndex', JSON.stringify(remainingChats));
      }
    } catch (error) {
      console.error('deleteChat failed:', error);
    }
  }, [user, firestore, activeChatId, createNewChat, setActiveChatId, chats]);


  const value = {
    chats: sortedChats,
    activeChatId,
    messages,
    isLoading: isChatsLoading,
    isMessagesLoading,
    setActiveChatId,
    setMessages,
    createNewChat,
    saveNewChat,
    togglePinChat,
    renameChat,
    deleteChat,
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
