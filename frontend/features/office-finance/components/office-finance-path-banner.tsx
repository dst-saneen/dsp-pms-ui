"use client";

import Link from "next/link";

const STEPS = [
  {
    key: "setup",
    href: "/office-finance/setup",
    label: "1. Setup (profile → parties → categories → accounts → periods)",
  },
  {
    key: "transactions",
    href: "/office-finance/transactions",
    label: "2. Transactions",
  },
  {
    key: "reports",
    href: "/office-finance/reports",
    label: "3. Reports",
  },
  {
    key: "dashboard",
    href: "/office-finance",
    label: "4. Dashboard",
  },
] as const;

export function OfficeFinancePathBanner({
  current,
  note,
}: {
  current: (typeof STEPS)[number]["key"];
  note?: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Office Finance path</p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => (
          <span key={step.key} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <Link
              href={step.href}
              className={
                step.key === current
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
