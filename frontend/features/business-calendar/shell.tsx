"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/administration/business-calendar", label: "Offices", match: "exact" },
  {
    href: "/administration/business-calendar/preview",
    label: "Calendar Preview",
    match: "prefix",
  },
  {
    href: "/administration/business-calendar/imports",
    label: "Import Holidays",
    match: "prefix",
  },
  {
    href: "/administration/business-calendar/impacts",
    label: "Review Changes",
    match: "prefix",
  },
] as const;

export function BusinessCalendarShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4 overflow-x-hidden">
      <nav
        aria-label="Business Calendar sections"
        className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
      >
        {TABS.map((tab) => {
          const active =
            tab.match === "exact"
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
