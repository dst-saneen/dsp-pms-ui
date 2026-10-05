"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export const SETUP_STEP_META = [
  {
    key: "profile",
    label: "1. Profile",
    title: "Company money basics (required)",
    purpose:
      "Set the Company's three-letter currency code and the first date you want to track money from. Do this before everything else.",
    nextKey: "parties",
    nextLabel: "Next: Parties",
  },
  {
    key: "parties",
    label: "2. Parties",
    title: "People / companies you deal with (recommended)",
    purpose:
      "Customer = who pays you. Vendor = who you pay. Use these names later on Income and Expense.",
    nextKey: "categories",
    nextLabel: "Next: Categories",
    prevKey: "profile",
    prevLabel: "Back: Profile",
  },
  {
    key: "categories",
    label: "3. Categories",
    title: "Labels for money (required for Income/Expense)",
    purpose:
      "Create simple labels like “Service Income” and “Office Expense”. These appear when you create a transaction.",
    nextKey: "accounts",
    nextLabel: "Next: Accounts",
    prevKey: "parties",
    prevLabel: "Back: Parties",
  },
  {
    key: "accounts",
    label: "4. Accounts",
    title: "Where cash sits (required)",
    purpose:
      "Add wallets such as Petty Cash (type Cash) or Operating Bank (type Bank). Money moves from / to these accounts.",
    nextKey: "periods",
    nextLabel: "Next: Periods",
    prevKey: "categories",
    prevLabel: "Back: Categories",
  },
  {
    key: "periods",
    label: "5. Periods",
    title: "Open month for posting (required)",
    purpose:
      "Create this month and keep it OPEN. You can only record transactions inside an open period.",
    nextHref: "/office-finance/transactions",
    nextLabel: "Done — go to Transactions",
    prevKey: "accounts",
    prevLabel: "Back: Accounts",
  },
] as const;

export type SetupStepKey = (typeof SETUP_STEP_META)[number]["key"];

function setupTabHref(tab: SetupStepKey) {
  return `/office-finance/setup?tab=${tab}`;
}

export function SetupStepGuide({ current }: { current: SetupStepKey }) {
  const step = SETUP_STEP_META.find((item) => item.key === current);
  if (!step) return null;

  const nextHref =
    "nextHref" in step && step.nextHref
      ? step.nextHref
      : "nextKey" in step && step.nextKey
        ? setupTabHref(step.nextKey)
        : null;
  const prevHref = "prevKey" in step && step.prevKey ? setupTabHref(step.prevKey) : null;

  return (
    <div className="border-border bg-card mb-4 rounded-lg border px-3 py-3 text-sm">
      <p className="font-medium">{step.title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{step.purpose}</p>
      <p className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        {SETUP_STEP_META.map((item, index) => (
          <span key={item.key} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <Link
              href={setupTabHref(item.key)}
              className={
                item.key === current ? "text-foreground font-medium underline" : "underline"
              }
            >
              {item.label}
            </Link>
          </span>
        ))}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {prevHref ? (
          <Button asChild size="sm" variant="outline">
            <Link href={prevHref}>{"prevLabel" in step ? step.prevLabel : "Back"}</Link>
          </Button>
        ) : null}
        {nextHref ? (
          <Button asChild size="sm">
            <Link href={nextHref}>{step.nextLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
