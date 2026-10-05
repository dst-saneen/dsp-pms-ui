"use client";

import Link from "next/link";

const STEPS = [
  {
    key: "queue",
    href: "/admin/operations/delivery",
    label: "1. Delivery queue",
  },
  {
    key: "dead-letters",
    href: "/admin/operations/delivery/dead-letters",
    label: "2. Dead letters",
  },
  {
    key: "suppressions",
    href: "/admin/operations/delivery/suppressions",
    label: "3. Suppressions",
  },
  {
    key: "exceptions",
    href: "/admin/operations/delivery/recipient-exceptions",
    label: "4. Recipient exceptions",
  },
  {
    key: "files",
    href: "/administration/operations/files",
    label: "5. File operations",
  },
  {
    key: "retention",
    href: "/settings/security/document-retention",
    label: "6. Document retention",
  },
] as const;

export function OpsPathBanner({
  current,
  note,
}: {
  current: (typeof STEPS)[number]["key"];
  note?: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Operations path</p>
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
