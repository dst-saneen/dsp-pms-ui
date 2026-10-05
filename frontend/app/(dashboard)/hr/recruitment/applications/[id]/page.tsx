"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { RecruitCandidateDialog } from "@/features/employee-career";
import { JobApplicationEditor } from "@/features/recruitment/applications";

function ApplicationDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tab = searchParams.get("tab") ?? undefined;
  const recruitOpen = searchParams.get("recruit") === "1";

  const handleRecruitOpenChange = (open: boolean) => {
    if (open) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("recruit");
    const query = next.toString();
    router.replace(
      query
        ? `/hr/recruitment/applications/${id}?${query}`
        : `/hr/recruitment/applications/${id}`,
    );
  };

  return (
    <>
      <JobApplicationEditor applicationId={id} defaultTab={tab} />
      <RecruitCandidateDialog
        open={recruitOpen}
        onOpenChange={handleRecruitOpenChange}
      />
    </>
  );
}

export default function ApplicationDetailPage() {
  return (
    <PageContainer>
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ApplicationDetailContent />
      </Suspense>
    </PageContainer>
  );
}
