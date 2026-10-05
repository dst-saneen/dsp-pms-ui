import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { HrRequestWorkspace } from "@/features/hr-operations";

export default function HrRequestsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="HR requests"
        description="Queue of employee paper requests. New request here is for the logged-in person — employees normally submit from My Workspace."
      />
      <HrRequestWorkspace mode="hr" />
    </PageContainer>
  );
}
