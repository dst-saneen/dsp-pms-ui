"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface AssetCommandReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  destructive?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function AssetCommandReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  destructive = false,
  onOpenChange,
  onConfirm,
}: AssetCommandReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
    }
  }
  const trimmedReason = reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">{description}</p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmedReason.length >= 3) {
              onConfirm(trimmedReason);
            }
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="asset-command-reason">
              Reason
            </label>
            <Textarea
              id="asset-command-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              required
              aria-describedby="asset-command-reason-help"
            />
            <p id="asset-command-reason-help" className="text-muted-foreground text-xs">
              Enter the actual business reason. At least 3 characters are required.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={loading || trimmedReason.length < 3}
            >
              {loading ? "Processing…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
