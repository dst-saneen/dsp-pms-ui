import { PageContainer } from "@/components/common/page-container";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { MyProjectsWorkspace } from "@/features/projects";

export default function MyWorkspaceProjectsPage() {
  return (
    <PageContainer>
      <ModuleCapabilityGate capability="projectsNav">
        <MyProjectsWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
