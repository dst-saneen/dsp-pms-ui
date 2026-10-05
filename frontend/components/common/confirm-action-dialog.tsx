"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  title: string;

  message?: string;

  name: string;

  code?: string;

  nameLabel?: string;
  codeLabel?: string;

  loading?: boolean;

  confirmLabel?: string;
  loadingLabel?: string;

  children?: ReactNode;

  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  message = "Please review this action before continuing.",
  name,
  code,
  nameLabel = "Name",
  codeLabel = "Code",
  loading = false,
  confirmLabel = "Confirm",
  loadingLabel = "Processing...",
  children,
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />

            <DialogTitle>{title}</DialogTitle>
          </div>

          <DialogDescription>
            Please review the information before continuing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          </div>

          <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-3">

            <div className="text-sm text-muted-foreground">
              {nameLabel}
            </div>

            <div className="font-medium break-words">
              {name}
            </div>

            {code && (
              <>
                <div className="text-sm text-muted-foreground">
                  {codeLabel}
                </div>

                <div className="font-medium">
                  {code}
                </div>
              </>
            )}

          </div>

          {children}

        </div>

        <DialogFooter className="gap-2">

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            variant="destructive"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading
              ? loadingLabel
              : confirmLabel}
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
