"use client";

import { CareersListing } from "./careers-listing";
import { CareersShell } from "./careers-shell";
import { usePublicCompany } from "../hooks/use-public-careers";

export function CareersCompanyPage({ companyCode }: { companyCode: string }) {
  const companyQuery = usePublicCompany(companyCode);

  if (companyQuery.isPending) {
    return (
      <CareersShell>
        <p className="text-sm text-muted-foreground">Loading careers…</p>
      </CareersShell>
    );
  }

  if (companyQuery.error || !companyQuery.data) {
    return (
      <CareersShell>
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="font-medium">Careers page not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Check the company code in the URL or contact the company directly.
          </p>
        </div>
      </CareersShell>
    );
  }

  return (
    <CareersShell companyName={companyQuery.data.companyName}>
      <CareersListing companyCode={companyCode} />
    </CareersShell>
  );
}
