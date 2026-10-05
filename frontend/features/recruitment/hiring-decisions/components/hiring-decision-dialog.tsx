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
  hiringDecisionSchema,
  type HiringDecisionFormValues,
} from "../validation/hiring-decision-schema";

interface HiringDecisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "select" | "reject";
  candidateName: string;
  loading?: boolean;
  onConfirm: (values: HiringDecisionFormValues) => void;
}

export function HiringDecisionDialog({
  open,
  onOpenChange,
  mode,
  candidateName,
  loading,
  onConfirm,
}: HiringDecisionDialogProps) {
  const form = useForm<HiringDecisionFormValues>({
    resolver: zodResolver(hiringDecisionSchema),
    defaultValues: {
      reasonCode: "",
      comment: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ reasonCode: "", comment: "" });
  }, [open, form]);

  const isSelect = mode === "select";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isSelect ? "Select candidate" : "Reject candidate"}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {isSelect
            ? `Confirm selection of ${candidateName}. HR will prepare the offer after this decision.`
            : `Provide the rejection reason for ${candidateName}. This action is recorded in the timeline.`}
        </p>

        <form className="space-y-4" onSubmit={form.handleSubmit(onConfirm)}>
          <div className="space-y-2">
            <RequiredLabel>Decision note</RequiredLabel>
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
            <Button
              type="submit"
              variant={isSelect ? "default" : "destructive"}
              disabled={loading}
            >
              {loading
                ? "Processing…"
                : isSelect
                  ? "Confirm selection"
                  : "Reject candidate"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
