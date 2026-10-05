"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { InterviewDetail } from "@/features/recruitment/interviews";

export default function InterviewDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <PageContainer>
      <InterviewDetail interviewId={id} />
    </PageContainer>
  );
}
