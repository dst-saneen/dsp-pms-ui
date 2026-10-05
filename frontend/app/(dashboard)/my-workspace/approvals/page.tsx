import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { MyWorkQueuesWorkspace } from "@/features/hr-operations";

export default function MyApprovalsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Approvals & clearance"
        description="Review requests assigned to you and complete clearance actions."
      />
      <MyWorkQueuesWorkspace />
    </PageContainer>
  );
}
