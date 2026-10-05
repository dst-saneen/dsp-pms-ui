import { PageContainer } from "@/components/common/page-container";
import { HrRequestWorkspace } from "@/features/hr-operations";

export default function MyHrRequestsPage() {
  return (
    <PageContainer>
      <HrRequestWorkspace mode="mine" />
    </PageContainer>
  );
}
