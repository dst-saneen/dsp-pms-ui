"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const rejectSchema = z.object({
  remarks: z
    .string()
    .trim()
    .min(5, "Enter a rejection reason (at least 5 characters).")
    .max(1000, "Rejection reason must be under 1000 characters."),
});

type RejectFormValues = z.infer<typeof rejectSchema>;

interface EmployeeDocumentRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  loading?: boolean;
  onConfirm: (remarks: string) => void;
}

export function EmployeeDocumentRejectDialog({
  open,
  onOpenChange,
  documentTitle,
  loading,
  onConfirm,
}: EmployeeDocumentRejectDialogProps) {
  const form = useForm<RejectFormValues>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { remarks: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ remarks: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject document</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Provide a clear rejection reason for{" "}
          <span className="font-medium text-foreground">{documentTitle}</span>.
          This reason is stored on the document and shown in history.
        </p>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) =>
            onConfirm(values.remarks.trim()),
          )}
        >
          <div className="space-y-2">
            <RequiredLabel>Rejection reason</RequiredLabel>
            <Textarea
              rows={4}
              placeholder="Explain why this document is rejected…"
              {...form.register("remarks")}
            />
            {form.formState.errors.remarks ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.remarks.message}
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
              {loading ? "Rejecting…" : "Reject document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
