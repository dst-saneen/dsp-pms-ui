"use client";

import Link from "next/link";

const STEPS = [
  {
    key: "types",
    href: "/hr/hr-requests",
    label: "1. Request types (HR)",
  },
  {
    key: "my-requests",
    href: "/my-workspace/hr-requests",
    label: "2. Employee submits",
  },
  {
    key: "approvals",
    href: "/my-workspace/approvals",
    label: "3. Approver / clearance",
  },
  {
    key: "hr-queue",
    href: "/hr/hr-requests",
    label: "4. HR queue / complete",
  },
  {
    key: "separations",
    href: "/hr/employee-separations",
    label: "5. Separations",
  },
] as const;

export function HrOpsPathBanner({
  current,
  note,
}: {
  current: (typeof STEPS)[number]["key"];
  note?: string;
}) {
  const currentHref = STEPS.find((step) => step.key === current)?.href;

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">HR operations path</p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => (
          <span key={step.key} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <Link
              href={step.href}
              className={
                step.href === currentHref && step.key === current
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
