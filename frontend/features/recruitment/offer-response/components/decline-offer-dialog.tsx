"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  offerDeclineSchema,
  type OfferDeclineFormValues,
} from "../validation/offer-response-schema";

interface DeclineOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading?: boolean;
  onConfirm: (values: OfferDeclineFormValues) => void;
}

export function DeclineOfferDialog({
  open,
  onOpenChange,
  loading,
  onConfirm,
}: DeclineOfferDialogProps) {
  const form = useForm<OfferDeclineFormValues>({
    resolver: zodResolver(offerDeclineSchema),
    defaultValues: {
      legalName: "",
      acknowledgement: false,
      reason: "",
    },
  });

  const acknowledgement = useWatch({
    control: form.control,
    name: "acknowledgement",
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      legalName: "",
      acknowledgement: false,
      reason: "",
    });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Decline offer</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Confirm that you want to decline this offer. This decision is final for
          this offer version.
        </p>

        <form className="space-y-4" onSubmit={form.handleSubmit(onConfirm)}>
          <div className="space-y-2">
            <RequiredLabel>Full legal name</RequiredLabel>
            <Input {...form.register("legalName")} autoComplete="name" />
            {form.formState.errors.legalName ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.legalName.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Textarea rows={3} {...form.register("reason")} />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 rounded border"
              checked={Boolean(acknowledgement)}
              onChange={(event) =>
                form.setValue("acknowledgement", event.target.checked, {
                  shouldValidate: true,
                })
              }
            />
            <span>I confirm that I am declining this offer.</span>
          </label>
          {form.formState.errors.acknowledgement ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.acknowledgement.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? "Submitting…" : "Confirm decline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
