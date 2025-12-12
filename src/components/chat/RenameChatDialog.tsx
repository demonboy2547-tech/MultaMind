'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChatIndexItem } from '@/lib/types';

interface RenameChatDialogProps {
  chat: ChatIndexItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export default function RenameChatDialog({ chat, isOpen, onClose, onSave }: RenameChatDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (chat) {
      setName(chat.title);
      setError('');
    }
  }, [chat]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 60) {
      setError('Title must be between 1 and 60 characters.');
      return;
    }
    onSave(trimmedName);
    onClose();
  };

  const handleClose = () => {
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Title
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
            />
          </div>
          {error && <p className="col-start-2 col-span-3 text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
