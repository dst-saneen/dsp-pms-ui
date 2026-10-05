import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { ProjectDetailWorkspace } from "@/features/projects";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PageContainer>
      <PageHeader
        title="Project detail"
        description="Overview, stages, team, tasks, time, and finance summary."
      />
      <ModuleCapabilityGate capability="projectsNav">
        <ProjectDetailWorkspace projectId={id} />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
