// src/app/page.tsx
'use client';

import { useState } from 'react';
import ChatLayout from '@/components/chat/ChatLayout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Home() {
  const [plan, setPlan] = useState<'free' | 'pro'>('free');

  return (
    <div className="flex flex-col h-screen">
      <div className="absolute top-4 right-28 z-20 flex items-center space-x-2">
        <Switch
          id="plan-switch"
          checked={plan === 'pro'}
          onCheckedChange={(checked) => setPlan(checked ? 'pro' : 'free')}
        />
        <Label htmlFor="plan-switch" className="text-sm font-medium">
          {plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
        </Label>
      </div>
      <ChatLayout plan={plan} />
    </div>
  );
}
