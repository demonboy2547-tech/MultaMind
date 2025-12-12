'use client';

import { useState } from 'react';
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

  if (isUserLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const handleSignOut = async () => {
    const auth = getAuth();
    await signOut(auth);
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="absolute top-4 right-4 z-20 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="plan-switch"
            checked={plan === 'pro'}
            onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
          />
          <Label htmlFor="plan-switch" className="text-sm font-medium">
            {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
          </Label>
        </div>
        <Button onClick={handleSignOut} variant="outline" size="sm">Sign Out</Button>
      </div>
      <ChatLayout plan={plan} />
    </div>
  );
}
