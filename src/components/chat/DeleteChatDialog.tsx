'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface DeleteChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteChatDialog({ isOpen, onClose, onConfirm }: DeleteChatDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
        } catch (error) {
            console.error("Failed to delete chat:", error);
            // Optionally: show a toast to the user
        } finally {
            setIsDeleting(false);
            onClose();
        }
    };
    
    const handleDialogStateChange = (open: boolean) => {
        if (!open || !isDeleting) {
            onClose();
        }
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={handleDialogStateChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the chat and all of its messages. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                        <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                         <Button onClick={handleConfirm} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete
                        </Button>
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
