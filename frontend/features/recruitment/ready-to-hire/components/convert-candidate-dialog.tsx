"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { ConversionPreflight } from "../types/conversion-preflight";

interface ConvertCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preflight: ConversionPreflight;
  loading?: boolean;
  onConfirm: (confirmationNote?: string) => Promise<void>;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function ConvertCandidateDialog({
  open,
  onOpenChange,
  preflight,
  loading = false,
  onConfirm,
}: ConvertCandidateDialogProps) {
  const [note, setNote] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert candidate to employee</DialogTitle>
          <DialogDescription>
            Confirm the hire details below. Conversion creates the employee record and
            starts onboarding.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Candidate</dt>
            <dd className="font-medium">{preflight.candidateName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-medium">{preflight.roleTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Organization</dt>
            <dd className="font-medium">{preflight.organizationSummary}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Joining date</dt>
            <dd className="font-medium">{formatDate(preflight.joiningDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Onboarding template</dt>
            <dd className="font-medium">{preflight.onboardingTemplateName}</dd>
          </div>
          {preflight.reportingManagerName ? (
            <div>
              <dt className="text-muted-foreground">Reporting manager</dt>
              <dd className="font-medium">{preflight.reportingManagerName}</dd>
            </div>
          ) : null}
        </dl>

        <div className="space-y-2">
          <Label htmlFor="conversion-note">Confirmation note (optional)</Label>
          <Textarea
            id="conversion-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add an internal note for the conversion audit trail."
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={() => {
              void onConfirm(note.trim() || undefined);
            }}
          >
            {loading ? "Converting…" : "Convert to employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
