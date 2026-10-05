"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import {
  applicationReasonSchema,
  type ApplicationReasonFormValues,
} from "../validation/application-schema";

interface ApplicationReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (values: ApplicationReasonFormValues) => void;
}

export function ApplicationReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
}: ApplicationReasonDialogProps) {
  const form = useForm<ApplicationReasonFormValues>({
    resolver: zodResolver(applicationReasonSchema),
    defaultValues: {
      reasonCode: "",
      comment: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ reasonCode: "", comment: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{description}</p>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(onConfirm)}
        >
          <div className="space-y-2">
            <RequiredLabel>Reason</RequiredLabel>
            <Textarea rows={4} {...form.register("comment")} />
            {form.formState.errors.comment ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.comment.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Processing…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
