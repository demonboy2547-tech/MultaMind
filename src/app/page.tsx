'use client';

import { useState, useMemo, useEffect, MouseEvent } from 'react';
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useUser, type UserProfile } from '@/firebase';
import { getAuth, signOut } from 'firebase/auth';
import { LogIn, LogOut, Plus, Search, MoreVertical, Pin, Share2, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import ChatLayout from '@/components/chat/ChatLayout';
import { ChatProvider, useChat } from '@/context/ChatContext';
import RenameChatDialog from '@/components/chat/RenameChatDialog';
import DeleteChatDialog from '@/components/chat/DeleteChatDialog';
import type { ChatIndexItem } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import PricingModal from '@/components/pricing/PricingModal';


function ChatHistory() {
  const { chats, activeChatId, setActiveChatId, isLoading, createNewChat, togglePinChat, renameChat, deleteChat } = useChat();
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingChat, setRenamingChat] = useState<ChatIndexItem | null>(null);
  const [deletingChat, setDeletingChat] = useState<ChatIndexItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredChats = useMemo(() => {
    const list = chats ?? [];
    if (!searchTerm) return list;
    return list.filter(chat =>
      chat.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [chats, searchTerm]);

  const handleMenuClick = (e: MouseEvent) => {
    e.stopPropagation();
  };
  
  const handlePinToggle = async (e: MouseEvent, chatId: string) => {
    e.stopPropagation();
    await togglePinChat(chatId);
  };

  const handleRename = (e: MouseEvent, chat: ChatIndexItem) => {
    e.stopPropagation();
    setOpenMenuId(null); // Close menu before opening dialog
    setRenamingChat(chat);
  };
  
  const handleDelete = (e: MouseEvent, chat: ChatIndexItem) => {
    e.stopPropagation();
    setOpenMenuId(null); // Close menu before opening dialog
    setDeletingChat(chat);
  };

  const handleShare = (e: MouseEvent, chat: ChatIndexItem) => {
    e.stopPropagation();
    const link = `${window.location.origin}?chat=${chat.id}`;
    navigator.clipboard.writeText(link).then(() => {
      toast({
        title: "Link copied!",
        description: "The chat link has been copied to your clipboard.",
      });
    });
  };

  const handleRenameSave = async (newName: string) => {
    if (renamingChat) {
      await renameChat(renamingChat.id, newName);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingChat) {
      await deleteChat(deletingChat.id);
      setDeletingChat(null);
    }
  };


  const renderChatList = () => {
    return filteredChats?.map((chat) => (
      <SidebarMenuItem key={chat.id}>
        <div className="flex items-center group">
            <SidebarMenuButton 
              isActive={chat.id === activeChatId} 
              className="h-8 justify-start flex-1" 
              onClick={() => setActiveChatId(chat.id)}
            >
              {chat.pinned && <Pin className="size-3 shrink-0" />}
              <span className="truncate flex-1 text-left ml-2">{chat.title}</span>
            </SidebarMenuButton>
            <DropdownMenu open={openMenuId === chat.id} onOpenChange={(isOpen) => setOpenMenuId(isOpen ? chat.id : null)}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" 
                  onClick={handleMenuClick}
                >
                  <MoreVertical className="size-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" onClick={handleMenuClick}>
                <DropdownMenuItem className="gap-2" onClick={(e) => handlePinToggle(e, chat.id)}>
                  <Pin className="size-4" />
                  <span>{chat.pinned ? 'Unpin' : 'Pin'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={(e) => handleShare(e, chat)}>
                  <Share2 className="size-4" />
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={(e) => handleRename(e, chat)}>
                  <Pencil className="size-4" />
                  <span>Rename</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={(e) => handleDelete(e, chat)}>
                  <Trash2 className="size-4" />
                  <span>Delete</span>
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
      {renamingChat && (
        <RenameChatDialog
          chat={renamingChat}
          isOpen={!!renamingChat}
          onClose={() => setRenamingChat(null)}
          onSave={handleRenameSave}
        />
      )}
      {deletingChat && (
        <DeleteChatDialog
            isOpen={!!deletingChat}
            onClose={() => setDeletingChat(null)}
            onConfirm={handleDeleteConfirm}
        />
      )}
    </>
  )
}

function HomePageContent() {
  const { user, profile, isUserLoading } = useUser();
  const { activeChatId } = useChat();
  const router = useRouter();
  const [isBillingLoading, setBillingLoading] = useState(false);
  const [isPricingModalOpen, setPricingModalOpen] = useState(false);
  const { toast } = useToast();
  
  const [plan, setPlan] = useState<'free' | 'pro' | 'standard'>('free');

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
        setPlan('free');
    } else {
        setPlan(profile?.plan || 'standard');
    }
  }, [user, profile, isUserLoading]);

  const handleSubscriptionAction = async (priceId?: string) => {
    setBillingLoading(true);

    if (!user) {
      router.push('/login');
      return;
    }
    
    const idToken = await user.getIdToken();

    try {
        let apiUrl = '';
        let bodyPayload: any = {};

        if (profile?.plan === 'pro') {
            apiUrl = '/api/stripe/create-portal-session';
        } else {
            apiUrl = '/api/stripe/create-checkout-session';
            if (!priceId) throw new Error("Price ID is required for upgrading.");
            bodyPayload = { priceId };
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: Object.keys(bodyPayload).length > 0 ? JSON.stringify(bodyPayload) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Something went wrong.');
        }

        if (data.url) {
            router.push(data.url);
        } else {
            throw new Error('Could not get redirect URL from server.');
        }

    } catch (error: any) {
        console.error('Subscription action failed:', error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to process subscription request.",
        });
    } finally {
        setBillingLoading(false);
        setPricingModalOpen(false);
    }
  };

  const handlePrimaryButtonClick = () => {
    if (user) {
        if (profile?.plan === 'pro') {
            handleSubscriptionAction(); // Manage subscription
        } else {
            setPricingModalOpen(true); // Open modal to upgrade
        }
    } else {
        router.push('/login'); // Go to login if not authenticated
    }
  };

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'G';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  const getPlanLabel = (currentPlan: typeof plan) => {
    switch (currentPlan) {
      case 'pro': return 'Pro Plan';
      case 'standard': return 'Standard Plan';
      default: return 'Free Plan';
    }
  };

  const renderSubscriptionButton = () => {
    if (isUserLoading) {
      return (
        <Button variant="outline" className="w-full justify-center" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading plan...
        </Button>
      );
    }
    
    let buttonText = "Log in to Upgrade";
    let buttonIcon = <LogIn className="size-4" />;
    
    if (user) {
        if (profile?.plan === 'pro') {
            buttonText = 'Manage Subscription';
            buttonIcon = <Sparkles className="size-4" />;
        } else {
            buttonText = 'Upgrade to Pro';
            buttonIcon = <Sparkles className="size-4" />;
        }
    }

    return (
        <Button 
            variant="outline" 
            className="w-full justify-center" 
            onClick={handlePrimaryButtonClick}
            disabled={isBillingLoading}
        >
            {isBillingLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : buttonIcon}
            <span className="group-data-[collapsible=icon]:hidden">{buttonText}</span>
        </Button>
    )
  }

  return (
    <>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <Sidebar collapsible="offcanvas">
            <SidebarContent className="p-0 flex flex-col">
              <ChatHistory />
            </SidebarContent>
            <SidebarFooter className="p-2 space-y-2">
              <div className="group-data-[collapsible=icon]:hidden">
                  {renderSubscriptionButton()}
              </div>

              {isUserLoading ? (
                <div className="flex items-center gap-2 p-2">
                  <div className="h-7 w-7 rounded-full bg-muted animate-pulse" />
                  <div className="h-4 w-20 rounded-md bg-muted animate-pulse group-data-[collapsible=icon]:hidden" />
                </div>
              ) : user && profile ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start gap-2 p-2 h-auto">
                      <Avatar className="size-7">
                          <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                          <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="text-left group-data-[collapsible=icon]:hidden">
                          <p className="text-xs font-medium truncate">{user.displayName || 'User'}</p>
                          <p className="text-xs text-muted-foreground truncate">{getPlanLabel(plan)}</p>
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
              ) : user ? (
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="size-7">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || 'User'} />
                      <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                  <div className="h-4 w-20 rounded-md bg-muted animate-pulse group-data-[collapsible=icon]:hidden" />
                </div>
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
      <PricingModal 
        isOpen={isPricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        onCheckout={handleSubscriptionAction}
        isLoading={isBillingLoading}
      />
    </>
  );
}


export default function Home() {
  return (
    <ChatProvider>
      <HomePageContent />
    </ChatProvider>
  )
}
