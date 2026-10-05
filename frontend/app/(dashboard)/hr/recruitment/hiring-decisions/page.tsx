import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { HiringDecisionsWorkspace } from "@/features/recruitment/hiring-decisions";

export default function HiringDecisionsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Hiring decisions"
        description="Compare interview-ready candidates and record select or reject as the assigned hiring manager."
      />
      <HiringDecisionsWorkspace />
    </PageContainer>
  );
}
