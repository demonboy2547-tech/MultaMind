'use client';

import { useState, useMemo, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { getAuth, signOut } from 'firebase/auth';
import { LogIn, LogOut, Plus, Search, MoreVertical, Pin, Share2, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import ChatLayout from '@/components/chat/ChatLayout';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';
import { RenameChatDialog } from '@/components/chat/RenameChatDialog';
import type { ChatIndexItem } from '@/lib/types';


function ChatHistory() {
  const { chats, activeChatId, setActiveChatId, isLoading, createNewChat, togglePinChat, renameChat } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [renameTargetChat, setRenameTargetChat] = useState<ChatIndexItem | null>(null);


  const handleChatAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  const filteredChats = useMemo(() => {
    if (!searchTerm) return chats;
    return chats?.filter(chat =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [chats, searchTerm]);

  const renderChatList = () => {
    return filteredChats?.map((chat) => (
      <SidebarMenuItem key={chat.id} className="relative group">
        <SidebarMenuButton isActive={chat.id === activeChatId} className="h-8 w-full justify-between" onClick={() => setActiveChatId(chat.id)}>
          <div className="flex items-center gap-2 truncate">
            {chat.pinned && <Pin className="size-3 shrink-0 text-amber-500" />}
            <span className="truncate">{chat.title}</span>
          </div>
        </SidebarMenuButton>
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem onClick={(e) => handleChatAction(e, () => togglePinChat(chat.id))}>
                  <Pin className="size-4 mr-2" />
                  {chat.pinned ? 'Unpin' : 'Pin'}
                </DropdownMenuItem>
                 <DropdownMenuItem onClick={(e) => handleChatAction(e, () => console.log('Share', chat.id))}>
                  <Share2 className="size-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleChatAction(e, () => setRenameTargetChat(chat))}>
                  <Pencil className="size-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleChatAction(e, () => console.log('Delete', chat.id))} className="text-destructive">
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </SidebarMenuItem>
    ));
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        <SidebarHeader>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={createNewChat}>
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">New Chat</span>
          </Button>
        </SidebarHeader>
        <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
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
      </div>
      {renameTargetChat && (
        <RenameChatDialog
          chat={renameTargetChat}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setRenameTargetChat(null);
            }
          }}
          onSave={(newTitle) => {
            renameChat(renameTargetChat.id, newTitle);
            setRenameTargetChat(null);
          }}
        />
      )}
    </>
  )
}

function HomePageContent() {
  const { user, isUserLoading } = useUser();
  const { activeChatId, setActiveChatId } = useChat();
  const [plan, setPlan] = useState<'free' | 'pro'>('free');

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
    setActiveChatId(null); // This will trigger context to reset to guest state
  };

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
          <SidebarContent className="p-0 flex flex-col">
             <ChatHistory />
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
          {activeChatId ? <ChatLayout plan={plan} /> : (
            <div className="flex-1 flex items-center justify-center">
              <p>Select a chat or start a new one.</p>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}


export default function Home() {
  return (
    <ChatProvider>
      <HomePageContent />
    </ChatProvider>
  )
}
