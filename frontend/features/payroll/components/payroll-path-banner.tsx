"use client";

import Link from "next/link";

const STEPS = [
  {
    key: "components",
    href: "/hr/payroll?tab=components",
    label: "1. Salary components",
  },
  {
    key: "salaries",
    href: "/hr/payroll?tab=salaries",
    label: "2. Employee salaries",
  },
  {
    key: "runs",
    href: "/hr/payroll?tab=runs",
    label: "3. Runs (preflight → create)",
  },
  {
    key: "run-detail",
    href: "/hr/payroll?tab=runs",
    label: "4. Calculate → Approve → Mark paid",
  },
  {
    key: "payslips",
    href: "/hr/payroll?tab=payslip-operations",
    label: "5. Payslips",
  },
  {
    key: "reports",
    href: "/hr/payroll?tab=reports",
    label: "6. Reports",
  },
] as const;

export function PayrollPathBanner({
  current,
  note,
  runDetailHref,
}: {
  current: (typeof STEPS)[number]["key"];
  note?: string;
  /** When on a run detail page, deep-link step 4 to that run. */
  runDetailHref?: string;
}) {
  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Payroll path</p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        {STEPS.map((step, index) => {
          const href =
            step.key === "run-detail" && runDetailHref
              ? runDetailHref
              : step.href;
          const isCurrent = step.key === current;
          return (
            <span key={step.key} className="inline-flex items-center gap-1">
              {index > 0 ? <span aria-hidden="true">→</span> : null}
              <Link
                href={href}
                className={
                  isCurrent
                    ? "font-medium text-foreground underline"
                    : "underline"
                }
              >
                {step.label}
              </Link>
            </span>
          );
        })}
      </p>
      {note ? (
        <p className="text-muted-foreground mt-1 text-xs">{note}</p>
      ) : null}
    </div>
  );
}
