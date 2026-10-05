"use client";

import { DataTable } from "@/components/tables/data-table";

import type { JobOffer } from "../types/job-offer";
import { offerColumns } from "./offer-columns";

interface OfferTableProps {
  data: JobOffer[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRowClick?: (offer: JobOffer) => void;
}

export function OfferTable({
  data,
  isLoading,
  error,
  onRetry,
  onRowClick,
}: OfferTableProps) {
  return (
    <DataTable
      columns={offerColumns}
      data={data}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle="No offers yet"
      emptyDescription="Prepare an offer after a candidate is selected by the hiring manager."
      onRowClick={onRowClick}
      getRowLabel={(offer) => `Open offer v${offer.versionNumber} for ${offer.candidateName}`}
    />
  );
}
