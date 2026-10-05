"use client";

import { ColumnDef } from "@tanstack/react-table";

import type { Candidate } from "../types/candidate";
import { formatApplicationSource } from "../../applications/utils/application-actions";

export const candidateColumns = (): ColumnDef<Candidate>[] => [
  {
    id: "name",
    header: "Candidate",
    cell: ({ row }) =>
      `${row.original.firstName} ${row.original.lastName}`.trim(),
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "mobile",
    header: "Mobile",
    cell: ({ row }) => row.original.mobile ?? "—",
  },
  {
    accessorKey: "primarySource",
    header: "Source",
    cell: ({ row }) => formatApplicationSource(row.original.primarySource),
  },
  {
    accessorKey: "applicationCount",
    header: "Applications",
  },
];
