'use client';

import { useState } from 'react';
import Link from 'next/link';
import ChatLayout from '@/components/chat/ChatLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { getAuth, signOut } from 'firebase/auth';

export default function Home() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
    // After signing out, you might want to refresh the page or stay on it.
    // For now, we'll just let the state update handle the UI change.
  };

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-2">
            <Switch
              id="plan-switch"
              checked={plan === 'pro'}
              onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
              disabled={!user} // Disable if not logged in
            />
            <Label htmlFor="plan-switch" className="text-sm font-medium">
              {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
            </Label>
          </div>
        )}
        {user ? (
          <Button onClick={handleSignOut} variant="outline" size="sm">
            Sign Out
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        )}
      </div>
      <ChatLayout plan={plan} />
    </div>
  );
}
