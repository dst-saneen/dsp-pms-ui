"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { CandidateProfile } from "@/features/recruitment/candidates";

export default function CandidateDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <PageContainer>
      <CandidateProfile candidateId={id} />
    </PageContainer>
  );
}
