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

import type { JobOffer } from "../types/job-offer";
import { OfferSummaryCard } from "../components/offer-summary-card";
import {
  revokeOfferSchema,
  type RevokeOfferFormValues,
} from "../validation/offer-schema";

type OfferActionMode = "preview" | "send" | "revoke";

interface OfferActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: OfferActionMode;
  offer: JobOffer | null;
  loading?: boolean;
  onConfirm: (values?: RevokeOfferFormValues) => void;
}

export function OfferActionDialog({
  open,
  onOpenChange,
  mode,
  offer,
  loading,
  onConfirm,
}: OfferActionDialogProps) {
  const form = useForm<RevokeOfferFormValues>({
    resolver: zodResolver(revokeOfferSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ reason: "" });
  }, [open, form]);

  if (!offer) return null;

  const title =
    mode === "preview"
      ? "Offer preview"
      : mode === "send"
        ? "Send offer"
        : "Revoke offer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <OfferSummaryCard offer={offer} />

        {mode === "send" && offer.headcountImpact ? (
          <p className="text-sm text-muted-foreground">
            Sending will reserve one headcount position on this opening.
          </p>
        ) : null}

        {mode === "send" ? (
          <p className="text-sm text-muted-foreground">
            Confirm the summary above before sending. Sent offers become read-only.
          </p>
        ) : null}

        {mode === "revoke" ? (
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => onConfirm(values))}
          >
            <p className="text-sm text-muted-foreground">
              Revoking releases the reserved headcount and returns the application to
              Selected.
            </p>
            <div className="space-y-2">
              <RequiredLabel>Revocation reason</RequiredLabel>
              <Textarea rows={4} {...form.register("reason")} />
              {form.formState.errors.reason ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.reason.message}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? "Revoking…" : "Revoke offer"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {mode === "send" ? (
              <Button disabled={loading} onClick={() => onConfirm()}>
                {loading ? "Sending…" : "Confirm send"}
              </Button>
            ) : null}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
