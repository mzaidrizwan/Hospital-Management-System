import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CustomPromptProps {
  open: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export const CustomPrompt: React.FC<CustomPromptProps> = ({
  open,
  title,
  message,
  defaultValue = '',
  onConfirm,
  onCancel
}) => {
  const [value, setValue] = useState(defaultValue);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Label>{message}</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter reason..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(value);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(value)}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};