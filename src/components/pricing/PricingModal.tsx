'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout: (priceId: string) => Promise<void>;
  isLoading: boolean;
}

export default function PricingModal({ isOpen, onClose, onCheckout, isLoading }: PricingModalProps) {
    // For now, we only have one plan, so we can hardcode the selection.
    // This could be expanded later with a useState for selection.
    const selectedPriceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID_MONTHLY;

    const handleCheckout = () => {
        if (selectedPriceId) {
            onCheckout(selectedPriceId);
        }
    };

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
                </DialogHeader>

                <div className="p-6">
                    <Card className="border-primary border-2 shadow-lg">
                        <CardHeader>
                            <CardTitle>Pro Monthly</CardTitle>
                            <CardDescription>Unlock premium features and the best AI models.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="text-4xl font-bold">
                                $19<span className="text-xl font-normal text-muted-foreground">/month</span>
                            </div>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Access to GPT-5.1</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Advanced Claude 3.5 Sonnet summarizer</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Long-term memory (coming soon)</li>
                                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> Priority support</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter>
                    <div className="w-full flex flex-col gap-2">
                        <Button
                            type="button"
                            onClick={handleCheckout}
                            disabled={isLoading || !selectedPriceId}
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
