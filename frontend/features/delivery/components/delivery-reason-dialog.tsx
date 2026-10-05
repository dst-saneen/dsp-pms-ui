"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

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

export const deliveryReasonSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required"),
});

export type DeliveryReasonFormValues = z.infer<typeof deliveryReasonSchema>;

export type DeliveryReasonMode = "retry" | "cancel";

interface DeliveryReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DeliveryReasonMode;
  loading?: boolean;
  description?: string;
  onConfirm: (values: DeliveryReasonFormValues) => void | Promise<void>;
}

const COPY: Record<
  DeliveryReasonMode,
  { title: string; description: string; confirmLabel: string }
> = {
  retry: {
    title: "Retry delivery",
    description:
      "Record why this message is being retried. The reason is stored with the next delivery attempt.",
    confirmLabel: "Retry delivery",
  },
  cancel: {
    title: "Cancel delivery",
    description:
      "Record why this message is being cancelled. Cancellation cannot be undone from this screen.",
    confirmLabel: "Cancel delivery",
  },
};

export function DeliveryReasonDialog({
  open,
  onOpenChange,
  mode,
  loading,
  description,
  onConfirm,
}: DeliveryReasonDialogProps) {
  const copy = COPY[mode];
  const form = useForm<DeliveryReasonFormValues>({
    resolver: zodResolver(deliveryReasonSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ reason: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {description ?? copy.description}
        </p>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            await onConfirm(values);
          })}
        >
          <div className="space-y-2">
            <RequiredLabel>Reason</RequiredLabel>
            <Textarea rows={4} {...form.register("reason")} />
            {form.formState.errors.reason ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
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
              variant={mode === "cancel" ? "destructive" : "default"}
              disabled={loading}
            >
              {loading ? "Working…" : copy.confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
