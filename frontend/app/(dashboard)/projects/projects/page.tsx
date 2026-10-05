import { Suspense } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { ProjectWorkspace } from "@/features/projects";

export default function ProjectsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Create Draft projects, configure Stages → Team → Tasks, Activate, then review and complete work."
      />
      <ModuleCapabilityGate capability="projectsNav">
        <Suspense
          fallback={
            <div className="bg-muted/40 h-40 animate-pulse rounded-xl" />
          }
        >
          <ProjectWorkspace />
        </Suspense>
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
