"use client";

import Link from "next/link";

const STEPS = [
  { href: "/hr/leave/types", label: "1. Types" },
  { href: "/hr/leave/policies", label: "2. Policies" },
  { href: "/hr/leave/balances", label: "3. Generate balances" },
  { href: "/hr/leave", label: "4. Requests" },
  { href: "/hr/leave/calendar", label: "5. Calendar" },
] as const;

export function LeaveSetupPathBanner({
  current,
  note,
}: {
  current:
    | "types"
    | "policies"
    | "balances"
    | "requests"
    | "calendar"
    | "comp-off"
    | "holidays";
  note?: string;
}) {
  const currentHref =
    current === "types"
      ? "/hr/leave/types"
      : current === "policies"
        ? "/hr/leave/policies"
        : current === "balances"
          ? "/hr/leave/balances"
          : current === "requests"
            ? "/hr/leave"
            : current === "calendar"
              ? "/hr/leave/calendar"
              : current === "comp-off"
                ? "/hr/leave/comp-off"
                : "/hr/leave/holidays";

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Leave setup path</p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => (
          <span key={step.href} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <Link
              href={step.href}
              className={
                step.href === currentHref
                  ? "font-medium text-foreground underline"
                  : "underline"
              }
            >
              {step.label}
            </Link>
          </span>
        ))}
      </p>
      {note ? (
        <p className="text-muted-foreground mt-1 text-xs">{note}</p>
      ) : null}
    </div>
  );
}
