import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SeparationWorkspace } from "@/features/hr-operations";

export default function EmployeeSeparationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Employee separations"
        description="Start exit for someone leaving: pick employee → last day → reason → clearance owners. Manager Approves, departments Clear, then HR Completes when assets are clear."
      />
      <SeparationWorkspace />
    </PageContainer>
  );
}
