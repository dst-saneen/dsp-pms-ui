"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { InterviewEvaluate } from "@/features/recruitment/interviews";

export default function InterviewEvaluatePage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <PageContainer>
      <InterviewEvaluate interviewId={id} />
    </PageContainer>
  );
}
