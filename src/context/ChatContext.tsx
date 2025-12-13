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
<<<<<<< HEAD
  deleteChat: (chatId: string) => void;
=======
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
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

<<<<<<< HEAD
function sortChats(a: ChatIndexItem, b: ChatIndexItem): number {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // For items with the same pinned status, sort by updatedAt
    const dateA = a.updatedAt || 0;
    const dateB = b.updatedAt || 0;
    return dateB - dateA;
}

=======
// Helper to sort chats with pinned items first
const sortChats = (chats: ChatIndexItem[]): ChatIndexItem[] => {
  return [...chats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Assuming updatedAt is a timestamp number.
    // If it can be a Firestore Timestamp object, you need to handle that.
    const dateA = (a.updatedAt as any)?.seconds ? new Date((a.updatedAt as any).seconds * 1000) : new Date(a.updatedAt);
    const dateB = (b.updatedAt as any)?.seconds ? new Date((b.updatedAt as any).seconds * 1000) : new Date(b.updatedAt);
    return dateB.getTime() - dateA.getTime();
  });
};
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad

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
<<<<<<< HEAD
      const transformedChats = firestoreChats.map(c => ({...c, updatedAt: (c.updatedAt as unknown as Timestamp)?.toMillis() || Date.now() }));
      setChats(transformedChats); 
=======
      const formattedChats = firestoreChats.map(c => ({
        ...c,
        // Ensure updatedAt is a number for consistent sorting
        updatedAt: (c.updatedAt as any)?.seconds ? (c.updatedAt as any).seconds * 1000 : c.updatedAt
      }))
      setChats(sortChats(formattedChats));
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
    } else if (!user) {
      const storedChats = localStorage.getItem('guestChatsIndex');
      if (storedChats) {
        const parsedChats: ChatIndexItem[] = JSON.parse(storedChats);
<<<<<<< HEAD
        setChats(parsedChats);
=======
        setChats(sortChats(parsedChats));
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
      } else {
        setChats([]);
      }
    }
  }, [user, firestoreChats]);
  
  const sortedChats = React.useMemo(() => {
    // Create a new sorted array from the chats state
    return [...chats].sort(sortChats);
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
<<<<<<< HEAD
                  createdAt: Timestamp.fromMillis(now),
                  updatedAt: Timestamp.fromMillis(now),
=======
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
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
<<<<<<< HEAD
          const updatedChats = [newChatIndexItem, ...chats];
          setChats(updatedChats);
=======
          const newChatIndex: ChatIndexItem = { id: chatId, title, updatedAt: Date.now(), pinned: false };
          const updatedChats = [newChatIndex, ...chats];
          
          setChats(sortChats(updatedChats));
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
          localStorage.setItem(`guestChat:${chatId}`, JSON.stringify(updatedMessages));
      }
  }, [user, firestore, chats]);

  const togglePinChat = useCallback(async (chatId: string) => {
<<<<<<< HEAD
    setChats(prevChats => {
      const chatToUpdate = prevChats.find(c => c.id === chatId);
      if (!chatToUpdate) return prevChats;

      const newPinnedState = !chatToUpdate.pinned;
      const updatedChats = prevChats.map(c => 
          c.id === chatId ? { ...c, pinned: newPinnedState, updatedAt: Date.now() } : c
      );

      if (user && firestore) {
          const chatRef = doc(firestore, 'chats', chatId);
          updateDoc(chatRef, { pinned: newPinnedState, updatedAt: serverTimestamp() }).catch(console.error);
      } else {
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
      }
      
      return updatedChats;
    });
  }, [user, firestore]);

  const renameChat = useCallback(async (chatId: string, newTitle: string) => {
    console.log(`[renameChat] Handler start for chat: ${chatId}`);
    
    // Optimistic UI update
    console.log('[renameChat] Performing optimistic UI state update.');
    setChats(prevChats => prevChats.map(c => 
      c.id === chatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
    ));
    console.log('[renameChat] UI state update complete.');

    // Persist changes
    try {
      if (user && firestore) {
        console.log('[renameChat] Sending request to Firestore.');
        const chatRef = doc(firestore, 'chats', chatId);
        await updateDoc(chatRef, { title: newTitle, updatedAt: serverTimestamp() });
        console.log('[renameChat] Firestore request successful.');
      } else {
        console.log('[renameChat] Persisting to localStorage.');
        const storedChats = localStorage.getItem('guestChatsIndex');
        if (storedChats) {
          const parsedChats: ChatIndexItem[] = JSON.parse(storedChats);
          const updatedChats = parsedChats.map(c =>
            c.id === chatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c
          );
          localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
        }
        console.log('[renameChat] localStorage persistence successful.');
      }
    } catch (error) {
      console.error('[renameChat] Error during persistence:', error);
      // Optional: Add logic to revert the optimistic update here
    }
  }, [user, firestore]);


  const deleteChat = useCallback(async (chatId: string) => {
    console.log(`[deleteChat] Handler start for chat: ${chatId}`);

    // Optimistically update the UI by filtering based on the current state
    setChats(prevChats => {
      console.log('[deleteChat] Performing optimistic UI state update.');
      const currentIndex = prevChats.findIndex(c => c.id === chatId);
      const remainingChats = prevChats.filter(c => c.id !== chatId);
      console.log(`[deleteChat] UI state update complete. ${remainingChats.length} chats remaining.`);
      
      if (activeChatId === chatId) {
        console.log('[deleteChat] Deleted chat was active. Determining next active chat.');
        let nextActiveChatId: string | null = null;
        if (remainingChats.length > 0) {
          // Try to select the next chat, or the previous one if it was the last
          const nextIndex = currentIndex < remainingChats.length ? currentIndex : remainingChats.length - 1;
          nextActiveChatId = remainingChats[nextIndex]?.id || null;
        }
        
        if (nextActiveChatId) {
          console.log(`[deleteChat] Setting next active chat to: ${nextActiveChatId}`);
          setActiveChatId(nextActiveChatId);
        } else {
          // If no chats are left, create a new draft
          console.log('[deleteChat] No chats left. Creating a new draft chat.');
          createNewChat();
        }
      }
      
      // Persist the changes in the background
      try {
        if (user && firestore) {
          console.log('[deleteChat] Sending request to Firestore.');
          const chatRef = doc(firestore, 'chats', chatId);
          deleteDoc(chatRef).then(() => {
            console.log('[deleteChat] Firestore request successful.');
          }).catch(error => {
             console.error('[deleteChat] Error during Firestore persistence:', error);
          });
        } else {
          console.log('[deleteChat] Persisting to localStorage.');
          localStorage.removeItem(`guestChat:${chatId}`);
          localStorage.setItem('guestChatsIndex', JSON.stringify(remainingChats));
          console.log('[deleteChat] localStorage persistence successful.');
        }
      } catch (error) {
         console.error('[deleteChat] Error during persistence initiation:', error);
      }

      return remainingChats;
    });

  }, [user, firestore, activeChatId, createNewChat]);
=======
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    const newPinnedState = !chat.pinned;
    const updatedChats = chats.map(c => c.id === chatId ? { ...c, pinned: newPinnedState } : c);
    
    setChats(sortChats(updatedChats));

    if (user && firestore) {
      try {
        const chatRef = doc(firestore, 'chats', chatId);
        await updateDoc(chatRef, { pinned: newPinnedState });
      } catch (error) {
        console.error("Error updating pin state in Firestore:", error);
        // Revert UI change on error
        setChats(sortChats(chats));
      }
    } else {
      localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
    }
  }, [chats, user, firestore]);

  const renameChat = useCallback(async (chatId: string, newTitle: string) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat || chat.title === newTitle) return;

    const updatedChats = chats.map(c => c.id === chatId ? { ...c, title: newTitle } : c);
    setChats(updatedChats); // No re-sorting needed as title doesn't affect order

    if (user && firestore) {
      try {
        const chatRef = doc(firestore, 'chats', chatId);
        await updateDoc(chatRef, { title: newTitle });
      } catch (error) {
        console.error("Error renaming chat in Firestore:", error);
        // Revert UI change on error
        setChats(chats);
      }
    } else { // Guest user
      localStorage.setItem('guestChatsIndex', JSON.stringify(updatedChats));
    }
  }, [chats, user, firestore]);
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad


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
<<<<<<< HEAD
    deleteChat,
=======
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
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
