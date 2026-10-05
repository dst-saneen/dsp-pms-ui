"use client";

import { PageContainer } from "@/components/common/page-container";
import { MyWorkspace } from "@/features/my-workspace";

export default function MyWorkspacePage() {
  return (
    <PageContainer className="gap-0">
      <MyWorkspace />
    </PageContainer>
  );
}
