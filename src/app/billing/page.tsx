
'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';
import { useToast } from "@/hooks/use-toast";

export default function BillingPage() {
  const { user, profile, isUserLoading } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubscriptionAction = async () => {
    setIsLoading(true);

    if (!user) {
      router.push('/login');
      return;
    }
    
    const idToken = await user.getIdToken();

    try {
        let apiUrl = '';
        let bodyPayload: any = {};

        if (profile?.plan === 'pro') {
            // User wants to manage their existing subscription
            apiUrl = '/api/stripe/create-portal-session';
        } else {
            // User wants to upgrade to Pro
            apiUrl = '/api/stripe/create-checkout-session';
            // This would be your monthly pro price ID from Stripe
            bodyPayload = { priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY };
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

        // Redirect to Stripe Checkout or Billing Portal
        if (data.url) {
            router.push(data.url);
        }

    } catch (error: any) {
        console.error('Subscription action failed:', error);
        toast({
            variant: "destructive",
            title: "Error",
            description: error.message || "Failed to process subscription action.",
        });
        setIsLoading(false);
    }
    // No need to set isLoading to false on success because we are redirecting away
  };

  const getButtonText = () => {
    if (isUserLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    if (profile?.plan === 'pro') return 'Manage Subscription';
    return 'Upgrade to Pro';
  };

  const getDescription = () => {
    if (profile?.plan === 'pro') {
      return `You are currently on the Pro plan. Click below to manage your billing details and subscription.`;
    }
    return `You are currently on the Standard plan. Upgrade to the Pro plan for access to the best models and features.`;
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>{isUserLoading ? 'Loading your plan...' : getDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSubscriptionAction}
            className="w-full"
            disabled={isLoading || isUserLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {getButtonText()}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
