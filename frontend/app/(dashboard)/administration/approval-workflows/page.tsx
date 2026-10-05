import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ApprovalWorkflowWorkspace } from "@/features/approval-workflow";

export default function ApprovalWorkflowsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Approval workflows"
        description="Configure the active Company's approval routing."
      />
      <ApprovalWorkflowWorkspace />
    </PageContainer>
  );
}
