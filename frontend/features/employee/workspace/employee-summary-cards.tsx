"use client";

import {
  CalendarCheck,
  FolderKanban,
  ClipboardList,
  Plane,
} from "lucide-react";

import { KpiGrid } from "@/components/common/kpi-grid";
import { KpiCard } from "@/components/common/kpi-card";
import { useMyProjectTasks } from "@/features/projects/hooks/use-projects";
import type { WorkspaceSummary } from "./types/employee-workspace";

interface EmployeeSummaryCardsProps {
  summary: WorkspaceSummary;
}

export function EmployeeSummaryCards({
  summary,
}: EmployeeSummaryCardsProps) {
  const myTasksQuery = useMyProjectTasks();
  const activeProjectTaskCount =
    myTasksQuery.data?.total ?? myTasksQuery.data?.items.length ?? null;

  const cards = [
    {
      title: "Attendance",
      value: summary.attendance.status,
      helperText: summary.attendance.checkIn
        ? `Checked in at ${summary.attendance.checkIn}`
        : "Not checked in",
      icon: CalendarCheck,
    },
    {
      title: "Leave Balance",
      value: `${summary.leave.remaining} days`,
      helperText: "Available leave",
      icon: Plane,
    },
    {
      title: "Assigned Tasks",
      value: summary.tasks.assigned,
      helperText: `${summary.tasks.dueToday} due today`,
      icon: ClipboardList,
    },
    {
      title: "Active Projects",
      value:
        activeProjectTaskCount !== null
          ? activeProjectTaskCount
          : summary.projects.active,
      helperText:
        activeProjectTaskCount !== null
          ? "Assigned project tasks"
          : "Current assignments",
      icon: FolderKanban,
    },
  ];

  return (
    <KpiGrid columns={4}>
      {cards.map((card) => (
        <KpiCard
          key={card.title}
          title={card.title}
          value={card.value}
          helperText={card.helperText}
          icon={card.icon}
        />
      ))}
    </KpiGrid>
  );
}
