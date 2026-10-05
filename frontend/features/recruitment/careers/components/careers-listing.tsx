"use client";

import { PublicOpeningCard } from "./public-opening-card";
import { usePublicOpenings } from "../hooks/use-public-careers";

interface CareersListingProps {
  companyCode: string;
}

export function CareersListing({ companyCode }: CareersListingProps) {
  const openingsQuery = usePublicOpenings(companyCode);

  if (openingsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading open positions…</p>;
  }

  if (openingsQuery.error) {
    return (
      <p className="text-sm text-muted-foreground">
        We could not load careers for this company right now.
      </p>
    );
  }

  const openings = openingsQuery.data ?? [];
  const activeOpenings = openings.filter((opening) => !opening.isExpired);

  if (openings.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        <p className="font-medium">No openings right now</p>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no published roles at the moment. Please check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Open positions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {activeOpenings.length} active opening{activeOpenings.length === 1 ? "" : "s"}
          {openings.length !== activeOpenings.length
            ? ` · ${openings.length - activeOpenings.length} past deadline`
            : ""}
        </p>
      </div>

      <div className="grid gap-4">
        {openings.map((opening) => (
          <PublicOpeningCard
            key={opening.openingCode}
            companyCode={companyCode}
            opening={opening}
          />
        ))}
      </div>
    </div>
  );
}
