"use client";

import { ColumnDef } from "@tanstack/react-table";

import { InterviewStatusBadge } from "../../components/interview-status-badge";
import type { InterviewSession } from "../types/interview";

function formatDateTime(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} (${timezone})`;
}

export const interviewColumns = (): ColumnDef<InterviewSession>[] => [
  {
    accessorKey: "scheduledStartAt",
    header: "When",
    cell: ({ row }) =>
      formatDateTime(row.original.scheduledStartAt, row.original.timezone),
  },
  {
    accessorKey: "roundName",
    header: "Round",
    cell: ({ row }) => `R${row.original.roundNumber} · ${row.original.roundName}`,
  },
  {
    id: "candidate",
    header: "Candidate",
    cell: ({ row }) => row.original.candidateName,
  },
  {
    id: "opening",
    header: "Opening",
    cell: ({ row }) =>
      `${row.original.openingCode} · ${row.original.openingTitle}`,
  },
  {
    accessorKey: "branchName",
    header: "Branch",
    cell: ({ row }) => row.original.branchName ?? "—",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <InterviewStatusBadge status={row.original.status} />,
  },
  {
    id: "panel",
    header: "Panel",
    cell: ({ row }) =>
      row.original.panelMembers.map((member) => member.employeeName).join(", ") ||
      "—",
  },
];
