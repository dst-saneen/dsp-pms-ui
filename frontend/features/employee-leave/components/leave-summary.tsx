import { CalendarCheck2, CalendarClock, CalendarDays, CircleGauge } from "lucide-react";

import { KpiCard } from "@/components/common";
import { KpiGrid } from "@/components/common/kpi-grid";

import type { EmployeeLeaveSummary } from "../types";

interface LeaveSummaryProps {
  summary: EmployeeLeaveSummary;
}

export function LeaveSummary({ summary }: LeaveSummaryProps) {
  return (
    <KpiGrid columns={4}>
      <KpiCard
        title="Entitlement"
        value={summary.totalEntitlement}
        icon={CalendarDays}
        helperText="Total assigned leave"
        density="compact"
      />

      <KpiCard
        title="Used"
        value={summary.totalUsed}
        icon={CalendarCheck2}
        helperText="Approved leave taken"
        tone="information"
        density="compact"
      />

      <KpiCard
        title="Pending"
        value={summary.totalPending}
        icon={CalendarClock}
        helperText="Awaiting a decision"
        tone="warning"
        density="compact"
      />

      <KpiCard
        title="Available"
        value={summary.totalBalance}
        icon={CircleGauge}
        helperText="Remaining leave balance"
        tone="success"
        density="compact"
      />
    </KpiGrid>
  );
}
