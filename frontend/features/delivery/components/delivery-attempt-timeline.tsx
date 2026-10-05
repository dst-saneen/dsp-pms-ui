"use client";

import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryAttempt, DeliveryAttemptOutcome } from "../types/delivery";

const OUTCOME_ICON: Record<DeliveryAttemptOutcome, React.ReactNode> = {
  ACCEPTED: <CheckCircle2 className="text-success size-4" />,
  DELIVERED: <CheckCircle2 className="text-success size-4" />,
  TRANSIENT_FAILURE: <Clock className="text-warning size-4" />,
  PERMANENT_FAILURE: <XCircle className="text-destructive size-4" />,
  AMBIGUOUS: <Clock className="text-warning size-4" />,
  BYPASSED: <Clock className="text-muted-foreground size-4" />,
  REJECTED_PERMANENT: <XCircle className="text-destructive size-4" />,
  REJECTED_TRANSIENT: <XCircle className="text-warning size-4" />,
  TIMEOUT: <Clock className="text-warning size-4" />,
  NETWORK_ERROR: <XCircle className="text-warning size-4" />,
};

const OUTCOME_LABEL: Record<DeliveryAttemptOutcome, string> = {
  ACCEPTED: "Accepted",
  DELIVERED: "Delivered",
  TRANSIENT_FAILURE: "Transient failure",
  PERMANENT_FAILURE: "Permanent failure",
  AMBIGUOUS: "Ambiguous provider result",
  BYPASSED: "Bypassed",
  REJECTED_PERMANENT: "Rejected (permanent)",
  REJECTED_TRANSIENT: "Rejected (transient)",
  TIMEOUT: "Timed out",
  NETWORK_ERROR: "Network error",
};

interface DeliveryAttemptTimelineProps {
  attempts: DeliveryAttempt[];
}

export function DeliveryAttemptTimeline({ attempts }: DeliveryAttemptTimelineProps) {
  if (attempts.length === 0) {
    return <p className="text-muted-foreground py-4 text-sm">No attempts yet.</p>;
  }

  return (
    <ol className="border-border relative space-y-6 border-l pl-6">
      {attempts.map((attempt, idx) => (
        <li key={attempt.id} className="relative">
          <span className="bg-background ring-border absolute -left-[1.15rem] flex size-6 items-center justify-center rounded-full ring-2">
            {OUTCOME_ICON[attempt.outcome]}
          </span>
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              attempt.outcome === "ACCEPTED"
                ? "border-success/20 bg-success-soft"
                : "border-warning/20 bg-warning-soft"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                Attempt {attempt.attemptNo} — {OUTCOME_LABEL[attempt.outcome]}
              </span>
              <span className="text-muted-foreground text-xs">
                {format(new Date(attempt.attemptedAt), "dd MMM yyyy, HH:mm:ss")}
              </span>
            </div>
            {attempt.durationMs !== null && (
              <p className="text-muted-foreground mt-1 text-xs">Duration: {attempt.durationMs}ms</p>
            )}
            {attempt.errorCode && (
              <p className="text-destructive mt-1 font-mono text-xs">{attempt.errorCode}</p>
            )}
            {attempt.providerRequestId && (
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                Provider ref: {attempt.providerRequestId}
              </p>
            )}
          </div>
          {idx < attempts.length - 1 && (
            <div className="border-border absolute top-7 -left-[0.65rem] h-full border-l border-dashed" />
          )}
        </li>
      ))}
    </ol>
  );
}
