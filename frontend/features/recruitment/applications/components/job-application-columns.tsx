"use client";

import { ColumnDef } from "@tanstack/react-table";

import { ApplicationStatusBadge } from "../../components/application-status-badge";
import type { JobApplication } from "../types/job-application";
import { formatApplicationSource } from "../utils/application-actions";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export const jobApplicationColumns = (): ColumnDef<JobApplication>[] => [
  {
    accessorKey: "applicationNumber",
    header: "Application #",
  },
  {
    id: "candidate",
    header: "Candidate",
    cell: ({ row }) =>
      `${row.original.candidateFirstName} ${row.original.candidateLastName}`.trim(),
  },
  {
    accessorKey: "openingTitle",
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
    cell: ({ row }) => <ApplicationStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "submittedAt",
    header: "Submitted",
    cell: ({ row }) => formatDate(row.original.submittedAt),
  },
  {
    accessorKey: "currentOwner",
    header: "Current owner",
    cell: ({ row }) => row.original.currentOwner ?? "—",
  },
  {
    accessorKey: "nextAction",
    header: "Next action",
    cell: ({ row }) => row.original.nextAction ?? "—",
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => formatApplicationSource(row.original.source),
  },
];
