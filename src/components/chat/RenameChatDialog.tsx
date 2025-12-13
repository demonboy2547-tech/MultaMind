'use client';

import { useState, useEffect } from 'react';
<<<<<<< HEAD
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
=======
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChatIndexItem } from '@/lib/types';
<<<<<<< HEAD
import { Loader2 } from 'lucide-react';

interface RenameChatDialogProps {
  chat: ChatIndexItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
}

export default function RenameChatDialog({ chat, isOpen, onClose, onSave }: RenameChatDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (chat) {
      setName(chat.title);
      setError('');
    }
  }, [chat]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      setError('Title must be between 1 and 60 characters.');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(trimmedName);
      onClose();
    } catch (e) {
      setError("Failed to save the new title. Please try again.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDialogStateChange = (open: boolean) => {
    if (!open || !isSaving) {
      onClose();
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogStateChange}>
      <DialogContent>
=======

interface RenameChatDialogProps {
  chat: ChatIndexItem;
  onSave: (newTitle: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function RenameChatDialog({ chat, onSave, onOpenChange }: RenameChatDialogProps) {
  const [title, setTitle] = useState(chat.title);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(chat.title);
    setError('');
  }, [chat]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1 || trimmedTitle.length > 60) {
      setError('Title must be between 1 and 60 characters.');
      return;
    }
    onSave(trimmedTitle);
  };

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
<<<<<<< HEAD
            <Label htmlFor="name" className="text-right">
              Title
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              disabled={isSaving}
            />
          </div>
          {error && <p className="col-start-2 col-span-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isSaving}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
=======
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
           {error && <p className="col-span-4 text-center text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            Save
>>>>>>> 1c586645bc776842b3345291ffd084621f4c1cad
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
