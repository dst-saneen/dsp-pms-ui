import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";

import type { EmployeeSummary } from "./types/employee-workspace";

interface EmployeeDashboardProps {
  employee: EmployeeSummary;
}

export function EmployeeDashboard({
  employee,
}: EmployeeDashboardProps) {
  const today = new Date();

  const greeting = (() => {
    const hour = today.getHours();

    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";

    return "Good Evening";
  })();
  const initials = employee.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join("")
    .toUpperCase();
  const isActive = employee.employmentStatus.toLowerCase() === "active";

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-12 border border-primary/10">
          <AvatarFallback className="bg-primary-soft font-semibold text-primary">
            {initials || "GE"}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {greeting}, {employee.fullName}
            </h1>
            <StatusBadge
              label={employee.employmentStatus}
              tone={isActive ? "success" : "neutral"}
            />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {employee.designation} · {employee.department} ·{" "}
            <span className="font-mono">{employee.employeeNo}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          <time suppressHydrationWarning>
            {today.toLocaleDateString(undefined, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </time>
        </div>

        <Button asChild variant="outline">
          <Link href="/hr/leave">Apply Leave</Link>
        </Button>
      </div>
    </section>
  );
}
