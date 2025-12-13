
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, getDocs, updateDoc, doc, writeBatch, Timestamp, setDoc, orderBy, deleteDoc } from 'firebase/firestore';
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
    // CRITICAL: Only create the query if the user is logged in and their UID is available.
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'));
  }, [user, firestore]);

  // useCollection will now correctly wait for the chatsQuery to be non-null.
  const { data: firestoreChats, isLoading: isChatsLoading } = useCollection<ChatIndexItem>(chatsQuery);
  
  // Effect to load chats from Firestore or localStorage
  useEffect(() => {
    if (user && firestoreChats) {
      const formattedChats = firestoreChats.map(c => ({
        ...c,
        updatedAt: (c.updatedAt as any)?.seconds ? (c.updatedAt as any).seconds * 1000 : c.updatedAt
      }));
      setChats(formattedChats);
    } else if (!user) {
      // When user logs out, clear firestore chats and load from local storage
      const storedChats = localStorage.getItem('guestChatsIndex');
      setChats(storedChats ? JSON.parse(storedChats) : []);
    }
  }, [user, firestoreChats]);
  
  const sortedChats = React.useMemo(() => {
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
      if (user && firestore) {
        const isDraft = !chats.some(chat => chat.id === activeChatId);
        if (isDraft) {
            setMessages([]);
            setMessagesLoading(false);
            return;
        }
        try {
            // No API routes needed anymore for this, direct client SDK access
            const messagesRef = collection(firestore, 'users', user.uid, 'chats', activeChatId, 'messages');
            const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
            const snapshot = await getDocs(messagesQuery);
            let loadedMessages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ChatMessage[];
            setMessages(loadedMessages);
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
  }, [activeChatId, user, firestore, chats]);
  
  const createNewChat = useCallback(() => {
    // Generate a placeholder ID. If the user is logged in, this ID will be used for the new document.
    const newChatId = user && firestore ? doc(collection(firestore, 'users', user.uid, 'chats')).id : `guest-${Date.now()}`;
    setActiveChatIdState(newChatId);
    setMessages([]); // Clear messages for the new chat
}, [user, firestore]);
  
  useEffect(() => {
      if (isChatsLoading) return; // Don't do anything while chats are loading
      if (activeChatId) return; // Don't do anything if a chat is already active

      // If there's no active chat, select the first one from the sorted list.
      if (sortedChats.length > 0) {
          setActiveChatIdState(sortedChats[0].id);
      } else {
          // If there are no chats at all, create a new one.
          createNewChat();
      }
  }, [sortedChats, activeChatId, isChatsLoading, createNewChat]);


  const setActiveChatId = (id: string | null) => {
    setMessages([]); // Clear messages when switching chats
    setActiveChatIdState(id);
  };

  const saveNewChat = useCallback(async (chatId: string, title: string, updatedMessages: ChatMessage[]) => {
      // Check if the chat already exists in our state
      const isExistingChat = chats.some(chat => chat.id === chatId);

      if (user && firestore) {
          // Logic for authenticated users
          const chatRef = doc(firestore, "users", user.uid, "chats", chatId);
          const messagesRef = collection(chatRef, 'messages');

          try {
              if (isExistingChat) {
                  // Existing chat: only update timestamp and add new messages
                  await updateDoc(chatRef, { updatedAt: serverTimestamp() });
                  const batch = writeBatch(firestore);
                  updatedMessages.forEach(message => {
                      if (!messages.some(m => m.id === message.id)) { // Only add messages not already in state
                          const messageRef = doc(messagesRef, message.id);
                          batch.set(messageRef, { ...message, createdAt: serverTimestamp() });
                      }
                  });
                  await batch.commit();

              } else {
                  // New chat: create chat document and add all messages
                  await setDoc(chatRef, {
                      userId: user.uid,
                      title: title,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      pinned: false,
                  });

                  const batch = writeBatch(firestore);
                  updatedMessages.forEach(message => {
                      const messageRef = doc(messagesRef, message.id);
                      batch.set(messageRef, { ...message, createdAt: serverTimestamp() });
                  });
                  await batch.commit();
                  
                  // Optimistically add to local state
                  const newChatIndexItem: ChatIndexItem = { id: chatId, title, updatedAt: Date.now(), pinned: false };
                  setChats(prevChats => [newChatIndexItem, ...prevChats]);
              }
          } catch (error) {
              console.error("Error saving chat to Firestore:", error);
          }
      } else {
          // Logic for guest users (localStorage)
          const now = Date.now();
          if (isExistingChat) {
              const updatedChats = chats.map(c => c.id === chatId ? {...c, updatedAt: now} : c);
              setChats(updatedChats);
              localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
              localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
          } else {
              const newChatIndexItem: ChatIndexItem = { id: chatId, title, updatedAt: now, pinned: false };
              const updatedChats = [newChatIndexItem, ...chats];
              setChats(updatedChats);
              localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
              localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
          }
      }
  }, [user, firestore, chats, messages]);

  const togglePinChat = useCallback(async (chatId: string) => {
    let nextPinned: boolean | null = null;
    const now = Date.now();
    // Optimistic UI update
    setChats(prev => {
      const target = prev.find(c => c.id === chatId);
      if (!target) return prev;
      nextPinned = !target.pinned;
      return prev.map(c => c.id === chatId ? { ...c, pinned: nextPinned!, updatedAt: now } : c);
    });

    try {
      if (user && firestore && nextPinned !== null) {
        const chatRef = doc(firestore, 'users', user.uid, 'chats', chatId);
        await updateDoc(chatRef, { pinned: nextPinned, updatedAt: serverTimestamp() });
      } else if (!user) {
        // Persist for guest user
        const stored = localStorage.getItem('guestChatsIndex');
        const parsed: ChatIndexItem[] = stored ? JSON.parse(stored) : [];
        const updated = parsed.map(c => c.id === chatId ? { ...c, pinned: !c.pinned, updatedAt: now } : c);
        localStorage.setItem('guestChatsIndex', JSON.stringify(updated));
      }
    } catch (err) {
      console.error('togglePinChat failed', err);
      // NOTE: Here you might want to add logic to revert the optimistic update
    }
  }, [user, firestore]);

  const renameChat = useCallback(async (chatId: string, newTitle: string) => {
    const now = Date.now();
    // Optimistic UI update
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle, updatedAt: now } : c));

    try {
      if (user && firestore) {
        const chatRef = doc(firestore, 'users', user.uid, 'chats', chatId);
        await updateDoc(chatRef, { title: newTitle, updatedAt: serverTimestamp() });
      } else if (!user) {
        // Persist for guest user
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
      // NOTE: Add logic to revert optimistic update on failure
    }
  }, [user, firestore]);


  const deleteChat = useCallback(async (chatId: string) => {
    const currentIndex = sortedChats.findIndex(c => c.id === chatId);
    const remainingChats = sortedChats.filter(c => c.id !== chatId);
    
    // Optimistically update UI
    setChats(remainingChats);
    
    // Switch to a different chat if the active one was deleted
    if (activeChatId === chatId) {
        let nextActiveId: string | null = null;
        if (remainingChats.length > 0) {
            // Try to select the next chat, or the previous one if it was the last
            nextActiveId = remainingChats[Math.min(currentIndex, remainingChats.length - 1)].id;
        }
        
        if (nextActiveId) {
            setActiveChatId(nextActiveId);
        } else {
            createNewChat(); // Creates a new draft if no chats are left
        }
    }

    try {
      if (user && firestore) {
        // For Firestore, we need to delete the chat document.
        // Deleting subcollections should ideally be handled by a Cloud Function for robustness,
        // but for now, we'll just delete the main chat document.
        const chatRef = doc(firestore, 'users', user.uid, 'chats', chatId);
        await deleteDoc(chatRef);
      } else if (!user) {
        // For guests, remove the messages and update the index from localStorage.
        localStorage.removeItem(`guestChat:${chatId}`);
        localStorage.setItem('guestChatsIndex', JSON.stringify(remainingChats));
      }
    } catch (error) {
      console.error('deleteChat failed:', error);
       // NOTE: You could revert the optimistic update here on failure.
       // For simplicity, we're not adding that right now.
    }
  }, [user, firestore, activeChatId, createNewChat, setActiveChatId, sortedChats]);


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

    

    