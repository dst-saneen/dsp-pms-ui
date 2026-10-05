"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { JobOfferDeliveryState } from "../types/job-offer";
import {
  formatOfferDeliveryStatus,
  isOfferDeliveryFailed,
  isOfferDeliveryPending,
  isOfferDeliverySent,
} from "../utils/offer-delivery";

interface CandidateOfferDeliveryNoticeProps {
  delivery: JobOfferDeliveryState;
  candidateResponseUrl?: string;
}

/** HR-facing delivery guidance. Dev/test also shows the candidate response link when mail is not configured. */
export function CandidateOfferDeliveryNotice({
  delivery,
  candidateResponseUrl,
}: CandidateOfferDeliveryNoticeProps) {
  const [copied, setCopied] = useState(false);
  const status = delivery.status;
  const label = formatOfferDeliveryStatus(status);

  let message =
    "The candidate receives a unique email link to accept or decline.";

  if (isOfferDeliveryPending(status)) {
    message =
      "Offer email is queued for delivery. Use the testing link below until mail is configured.";
  } else if (isOfferDeliverySent(status)) {
    message = "Offer email was sent. The candidate can also use the testing link below.";
  } else if (isOfferDeliveryFailed(status)) {
    message =
      delivery.failureReason ??
      "Offer email delivery failed. Use Retry delivery when it is available, or open the testing link below.";
  }

  const handleCopy = async () => {
    if (!candidateResponseUrl) return;
    try {
      await navigator.clipboard.writeText(candidateResponseUrl);
      setCopied(true);
      toast.success("Candidate offer link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the offer link.");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Candidate delivery · {label}</p>
        <p className="text-muted-foreground text-sm">{message}</p>
        {delivery.lastAttemptAt ? (
          <p className="text-muted-foreground text-xs">
            Last attempt: {new Date(delivery.lastAttemptAt).toLocaleString()}
          </p>
        ) : null}
      </div>

      {candidateResponseUrl ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Testing candidate link</p>
          <p className="text-muted-foreground text-xs">
            Mail is not required for this. Open this link to accept or decline as the candidate.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={candidateResponseUrl}
              className="flex-1 font-mono text-xs"
              aria-label="Candidate offer response link"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={candidateResponseUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
