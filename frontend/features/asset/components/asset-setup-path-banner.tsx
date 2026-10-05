"use client";

import Link from "next/link";

const STEPS = [
  { href: "/asset-management/asset-categories", label: "1. Categories", key: "categories" },
  { href: "/asset-management/asset-types", label: "2. Types", key: "types" },
  { href: "/asset-management/assets", label: "3. Physical assets", key: "assets" },
  { href: "/asset-management/licenses", label: "4. Licences", key: "licenses" },
  { href: "/asset-management/department-grants", label: "5. Dept grants", key: "grants" },
  { href: "/asset-management/inbox", label: "6. Inbox", key: "inbox" },
] as const;

export function AssetSetupPathBanner({
  current,
  note,
}: {
  current: (typeof STEPS)[number]["key"] | "transfers" | "waivers" | "employee-assets";
  note?: string;
}) {
  const currentHref =
    current === "transfers"
      ? "/asset-management/transfers"
      : current === "waivers"
        ? "/asset-management/waivers"
        : current === "employee-assets"
          ? "/asset-management/employee-assets"
          : STEPS.find((step) => step.key === current)?.href;

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <p className="font-medium">Assets setup path</p>
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
      {current === "transfers" || current === "waivers" ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Related:{" "}
          <Link className="underline" href="/asset-management/transfers">
            Transfers
          </Link>
          {" · "}
          <Link className="underline" href="/asset-management/waivers">
            Waivers
          </Link>
          {" · "}
          <Link className="underline" href="/asset-management/employee-assets">
            Employee assets
          </Link>
        </p>
      ) : null}
    </div>
  );
}
