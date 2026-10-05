"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PreflightCheckItem } from "../types/conversion-preflight";
import {
  resolveConversionRemediation,
  type ConversionRemediationContext,
} from "../utils/conversion-remediation";

interface PreflightChecklistProps {
  checks: PreflightCheckItem[];
  remediationContext?: ConversionRemediationContext;
}

function StatusIcon({ status }: { status: PreflightCheckItem["status"] }) {
  if (status === "PASSED") {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (status === "BLOCKED") {
    return <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  }
  return <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />;
}

export function PreflightChecklist({
  checks,
  remediationContext,
}: PreflightChecklistProps) {
  return (
    <ul className="space-y-3" aria-label="Conversion preflight checklist">
      {checks.map((item) => {
        const remediation =
          remediationContext &&
          (item.status === "BLOCKED" || item.status === "WARNING")
            ? resolveConversionRemediation(item.code, remediationContext)
            : null;

        return (
          <li
            key={item.code}
            role="status"
            aria-label={`${item.label}: ${item.status.toLowerCase()}`}
            className={cn(
              "flex gap-3 rounded-lg border px-3 py-2.5 text-sm",
              item.status === "PASSED" && "border-emerald-200 bg-emerald-50/50",
              item.status === "BLOCKED" && "border-destructive/30 bg-destructive/5",
              item.status === "WARNING" && "border-amber-200 bg-amber-50/50",
            )}
          >
            <StatusIcon status={item.status} />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{item.label}</p>
              <p className="text-muted-foreground">{item.message}</p>
              {remediation ? (
                <Link
                  href={remediation.href}
                  className="text-primary inline-flex text-sm font-medium hover:underline"
                >
                  {remediation.label}
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
