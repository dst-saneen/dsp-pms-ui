"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { OfferStatusBadge } from "../../components/offer-status-badge";
import type { JobOffer } from "../types/job-offer";
import { formatOfferDeliveryStatus } from "../utils/offer-delivery";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export const offerColumns: ColumnDef<JobOffer>[] = [
  {
    accessorKey: "applicationNumber",
    header: "Application",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.applicationNumber}</p>
        <p className="text-muted-foreground text-xs">{row.original.candidateName}</p>
      </div>
    ),
  },
  {
    accessorKey: "openingTitle",
    header: "Opening",
    cell: ({ row }) => (
      <div>
        <p>{row.original.openingTitle}</p>
        <p className="text-muted-foreground text-xs">{row.original.openingCode}</p>
      </div>
    ),
  },
  {
    accessorKey: "versionNumber",
    header: "Version",
    cell: ({ row }) => `v${row.original.versionNumber}`,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <OfferStatusBadge status={row.original.status} />,
  },
  {
    id: "compensation",
    header: "Compensation",
    cell: ({ row }) =>
      `${row.original.compensation.currency} ${row.original.compensation.amount.toLocaleString()}`,
  },
  {
    accessorKey: "expiryDate",
    header: "Expires",
    cell: ({ row }) => formatDate(row.original.expiryDate),
  },
  {
    id: "delivery",
    header: "Delivery",
    cell: ({ row }) => formatOfferDeliveryStatus(row.original.delivery.status),
  },
];
