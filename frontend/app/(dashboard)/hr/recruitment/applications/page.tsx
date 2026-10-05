"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RecruitCandidateDialog } from "@/features/employee-career";
import { JobApplicationWorkspace } from "@/features/recruitment/applications";

function ApplicationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recruitOpen = searchParams.get("recruit") === "1";

  const handleRecruitOpenChange = (open: boolean) => {
    if (open) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("recruit");
    const query = params.toString();
    router.replace(
      query
        ? `/hr/recruitment/applications?${query}`
        : "/hr/recruitment/applications",
    );
  };

  return (
    <>
      <JobApplicationWorkspace />
      <RecruitCandidateDialog
        open={recruitOpen}
        onOpenChange={handleRecruitOpenChange}
      />
    </>
  );
}

export default function ApplicationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Applications"
        description="Track each candidate's application through screening, interviews, and offer."
      />
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <ApplicationsPageContent />
      </Suspense>
    </PageContainer>
  );
}
