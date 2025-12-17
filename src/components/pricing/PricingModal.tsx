'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getProPriceIds } from '@/lib/stripe/pricing';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (priceId: string) => Promise<void>;
  isLoading: boolean;
  isLoggedIn: boolean;
}

export default function PricingModal({ isOpen, onClose, onCheckout, isLoading, isLoggedIn }: PricingModalProps) {
    const proPriceIds = getProPriceIds();
    const selectedPriceId = proPriceIds.monthly;

    const handleCheckout = () => {
        if (selectedPriceId && isLoggedIn) {
            onCheckout(selectedPriceId);
        }
    };

    const isButtonDisabled = isLoading || !isLoggedIn || !selectedPriceId;
    
    const disabledReason = useMemo(() => {
        if (!isLoggedIn) return "You must be logged in to upgrade.";
        if (!selectedPriceId) return "Stripe pricing is not configured. Please contact support.";
        return null;
    }, [isLoggedIn, selectedPriceId]);


    const handleDialogStateChange = (open: boolean) => {
        if (!open || !isLoading) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogStateChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl">Upgrade to Pro</DialogTitle>
                     <DialogDescription className="text-center">
                        Unlock premium features with our monthly plan.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 pt-0">
                    <Card className="border-primary border-2 shadow-lg">
                        <CardHeader>
                            <CardTitle>Pro Monthly</CardTitle>
                            <CardDescription>Unlock the most powerful AI models and features.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-4xl font-bold">
                                $19<span className="text-xl font-normal text-muted-foreground">/month</span>
                            </div>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Access to the best AI models</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Advanced summarizer & reviews</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Long-term chat memory</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Priority support</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter>
                    <div className="w-full flex flex-col gap-2">
                        {disabledReason && (
                            <Alert variant="destructive">
                                <AlertDescription>{disabledReason}</AlertDescription>
                            </Alert>
                        )}
                        <Button
                            type="button"
                            onClick={handleCheckout}
                            disabled={isButtonDisabled}
                            className="w-full"
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Proceed to Checkout
                        </Button>
                         <DialogClose asChild>
                            <Button type="button" variant="ghost" disabled={isLoading}>
                                Cancel
                            </Button>
                        </DialogClose>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
