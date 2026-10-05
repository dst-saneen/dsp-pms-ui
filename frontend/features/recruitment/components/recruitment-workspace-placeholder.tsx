"use client";

import { FeaturePlaceholder } from "@/components/common/feature-placeholder";
import { WorkspaceShell } from "@/components/common/workspace-shell";

interface RecruitmentWorkspacePlaceholderProps {
  title: string;
  description: string;
  step?: string;
}

export function RecruitmentWorkspacePlaceholder({
  title,
  description,
  step,
}: RecruitmentWorkspacePlaceholderProps) {
  return (
    <WorkspaceShell>
      <FeaturePlaceholder
        title={title}
        description={description}
        workOrder={step}
      />
    </WorkspaceShell>
  );
}
