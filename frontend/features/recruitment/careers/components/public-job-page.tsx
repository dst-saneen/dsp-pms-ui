"use client";

import { CareersShell } from "./careers-shell";
import { PublicJobDetail } from "./public-job-detail";
import { usePublicCompany } from "../hooks/use-public-careers";

interface PublicJobPageProps {
  companyCode: string;
  openingCode: string;
}

export function PublicJobPage({ companyCode, openingCode }: PublicJobPageProps) {
  const companyQuery = usePublicCompany(companyCode);

  return (
    <CareersShell companyName={companyQuery.data?.companyName}>
      <PublicJobDetail companyCode={companyCode} openingCode={openingCode} />
    </CareersShell>
  );
}
