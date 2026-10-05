"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

interface Props {

  open: boolean;

  title: string;

  description: string;

  loading?: boolean;

  onCancel(): void;

  onConfirm(): void;

}

export function ConfirmDialog({

  open,

  title,

  description,

  loading,

  onCancel,

  onConfirm,

}: Props) {

  return (

    <Dialog
      open={open}
      onOpenChange={onCancel}
    >

      <DialogContent>

        <DialogHeader>

          <DialogTitle>

            {title}

          </DialogTitle>

        </DialogHeader>

        <p className="text-sm text-muted-foreground">

          {description}

        </p>

        <DialogFooter>

          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            disabled={loading}
            onClick={onConfirm}
          >
            Delete
          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}