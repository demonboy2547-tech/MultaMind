'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChatIndexItem } from '@/lib/types';

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
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
