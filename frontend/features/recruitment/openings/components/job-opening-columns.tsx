"use client";

import { ColumnDef } from "@tanstack/react-table";

import { OpeningStatusBadge } from "../../components/opening-status-badge";
import type { JobOpening } from "../types/job-opening";
import { CopyOpeningApplyButton } from "./opening-apply-link";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export const jobOpeningColumns = (): ColumnDef<JobOpening>[] => [
  {
    accessorKey: "openingCode",
    header: "Code",
  },
  {
    accessorKey: "title",
    header: "Title",
  },
  {
    id: "organization",
    header: "Organization",
    cell: ({ row }) => {
      const opening = row.original;
      return [
        opening.companyName,
        opening.branchName,
        opening.departmentName,
      ]
        .filter(Boolean)
        .join(" · ") || "—";
    },
  },
  {
    accessorKey: "designationName",
    header: "Designation",
    cell: ({ row }) => row.original.designationName ?? "—",
  },
  {
    id: "headcount",
    header: "Headcount",
    cell: ({ row }) => {
      const { used, reserved, remaining, approved } = row.original.headcount;
      return `${used}/${reserved}/${remaining} of ${approved}`;
    },
  },
  {
    accessorKey: "applicationDeadline",
    header: "Deadline",
    cell: ({ row }) => formatDate(row.original.applicationDeadline),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <OpeningStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "nextAction",
    header: "Next action",
    cell: ({ row }) => row.original.nextAction ?? "—",
  },
  {
    id: "applyLink",
    header: "Apply link",
    cell: ({ row }) => <CopyOpeningApplyButton opening={row.original} />,
  },
];
