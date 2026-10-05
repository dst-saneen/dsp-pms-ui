import { Suspense } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchWorkspace } from "@/features/branch";

export default function BranchPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Branches"
        description="Manage operating locations within each company."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        }
      >
        <BranchWorkspace />
      </Suspense>
    </PageContainer>
  );
}
