"use client";

import { useState, type MouseEvent } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { JobOpening } from "../types/job-opening";
import {
  getOpeningApplyUrl,
  isOpeningAcceptingApplications,
} from "../utils/opening-apply-url";

interface OpeningApplyLinkProps {
  opening: JobOpening;
}

export function OpeningApplyLink({ opening }: OpeningApplyLinkProps) {
  const [copied, setCopied] = useState(false);
  const url = getOpeningApplyUrl(opening.companyCode, opening.openingCode);
  const accepting = isOpeningAcceptingApplications(opening.status);

  if (!url) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Apply link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the apply link.");
    }
  };

  return (
    <div className="rounded-xl border p-4">
      <p className="font-medium">Candidate apply link</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {accepting
          ? "Share this public page. Candidates can apply without logging in."
          : "Publish the opening first. This link works only while status is Open."}
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          readOnly
          value={url}
          className="flex-1"
          aria-label="Candidate apply link"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => void handleCopy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {accepting ? (
            <Button type="button" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CopyOpeningApplyButton({ opening }: OpeningApplyLinkProps) {
  const url = getOpeningApplyUrl(opening.companyCode, opening.openingCode);
  const accepting = isOpeningAcceptingApplications(opening.status);

  if (!url || !accepting) {
    return <span className="text-muted-foreground">—</span>;
  }

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Apply link copied");
    } catch {
      toast.error("Could not copy the apply link.");
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={(event) => void handleCopy(event)}
    >
      <Copy className="h-4 w-4" />
      Copy
    </Button>
  );
}
