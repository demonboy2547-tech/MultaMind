'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useCollection, useUser } from '@/firebase';
import { getAuth, signOut } from 'firebase/auth';
import { LogIn, LogOut, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { collection, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { Chat, GuestChat } from '@/lib/types';
import { useMemoFirebase } from '@/firebase/provider';
import ChatLayout from '@/components/chat/ChatLayout';


function ChatHistory({ activeChatId, setActiveChatId }: { activeChatId: string | null, setActiveChatId: (id: string | null) => void }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [guestChats, setGuestChats] = useState<GuestChat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const chatsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'chats'), where('userId', '==', user.uid));
  }, [user, firestore]);

  const { data: chats, isLoading } = useCollection<Chat>(chatsQuery);

  useEffect(() => {
    if (!user) {
      const storedChats = localStorage.getItem('guestChatsIndex');
      if (storedChats) {
        const parsedChats = JSON.parse(storedChats);
        parsedChats.sort((a: GuestChat, b: GuestChat) => b.updatedAt - a.updatedAt);
        setGuestChats(parsedChats);
      }
    }
  }, [user]);

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
  }

  const filteredChats = useMemo(() => {
    if (!searchTerm) return chats;
    return chats?.filter(chat =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [chats, searchTerm]);

  const filteredGuestChats = useMemo(() => {
    if (!searchTerm) return guestChats;
    return guestChats.filter(chat =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [guestChats, searchTerm]);

  const renderChatList = () => {
    if (user) {
       return filteredChats?.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton isActive={chat.id === activeChatId} className="h-8" onClick={() => handleSelectChat(chat.id)}>
            <span className="truncate">{chat.title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ));
    } else {
       return filteredGuestChats.map((chat) => (
         <SidebarMenuItem key={chat.id}>
           <SidebarMenuButton isActive={chat.id === activeChatId} className="h-8" onClick={() => handleSelectChat(chat.id)}>
             <span className="truncate">{chat.title}</span>
           </SidebarMenuButton>
         </SidebarMenuItem>
       ));
    }
  }

  return (
    <div className="flex flex-col gap-2 px-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search chats..." 
          className="w-full rounded-lg bg-background pl-8" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <span className="px-2 text-xs font-medium text-muted-foreground">Your Chats</span>
          </SidebarMenuItem>
          {isLoading && (
            <>
              <SidebarMenuItem><SidebarMenuButton className="h-8" asChild><div className="h-4 w-3/4 rounded-md bg-muted animate-pulse" /></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton className="h-8" asChild><div className="h-4 w-1/2 rounded-md bg-muted animate-pulse" /></SidebarMenuButton></SidebarMenuItem>
              <SidebarMenuItem><SidebarMenuButton className="h-8" asChild><div className="h-4 w-2/3 rounded-md bg-muted animate-pulse" /></SidebarMenuButton></SidebarMenuItem>
            </>
          )}
          {renderChatList()}
        </SidebarMenu>
      </div>
    </div>
  )
}

export default function Home() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
    setActiveChatId(null);
  };
  
  const handleNewChat = useCallback(async () => {
    if (user && firestore) {
      const newChatRef = await addDoc(collection(firestore, 'chats'), {
        userId: user.uid,
        title: 'New Chat',
        createdAt: serverTimestamp(),
      });
      setActiveChatId(newChatRef.id);
    } else {
      const newChatId = `guest-${Date.now()}`;
      const newChat: GuestChat = { id: newChatId, title: 'New Chat', updatedAt: Date.now(), messages: [] };

      const indexStr = localStorage.getItem('guestChatsIndex') || '[]';
      const index: Pick<GuestChat, 'id' | 'title' | 'updatedAt'>[] = JSON.parse(indexStr);
      index.push({ id: newChat.id, title: newChat.title, updatedAt: newChat.updatedAt });
      localStorage.setItem('guestChatsIndex', JSON.stringify(index));
      
      localStorage.setItem(`guestChat:${newChatId}`, JSON.stringify([]));

      setActiveChatId(newChatId);
    }
  }, [user, firestore]);

  useEffect(() => {
    if (!activeChatId) {
      handleNewChat();
    }
  }, [activeChatId, handleNewChat]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'G';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar collapsible="offcanvas">
          <SidebarHeader>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleNewChat}>
              <Plus className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
            </Button>
          </SidebarHeader>
          <SidebarContent className="p-0">
             <ChatHistory activeChatId={activeChatId} setActiveChatId={setActiveChatId}/>
          </SidebarContent>
          <SidebarFooter className="p-2">
            {isUserLoading ? (
              <div className="flex items-center gap-2 p-2">
                <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-20 rounded-md bg-muted animate-pulse group-data-[collapsible=icon]:hidden" />
              </div>
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 p-2 h-auto">
                     <Avatar className="size-7">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div className="text-left group-data-[collapsible=icon]:hidden">
                        <p className="text-xs font-medium truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                   <DropdownMenuItem onClick={handleSignOut} className="gap-2">
                      <LogOut className="size-4"/>
                      <span>Sign Out</span>
                   </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" className="w-full justify-start gap-2">
                <Link href="/login">
                  <LogIn className="size-4" />
                  <span className="group-data-[collapsible=icon]:hidden">Log in</span>
                </Link>
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1">
           <header className="flex h-12 items-center justify-start gap-2 border-b bg-background px-4 md:hidden">
              <SidebarTrigger />
              <h1 className="font-semibold">MultaMind</h1>
            </header>
          {activeChatId && <ChatLayout plan={plan} activeChatId={activeChatId} />}
        </div>
      </div>
    </SidebarProvider>
  );
}
