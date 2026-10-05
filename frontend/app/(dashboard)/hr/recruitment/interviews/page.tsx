import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { InterviewWorkspace } from "@/features/recruitment/interviews";

export default function InterviewsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Interview Calendar"
        description="Schedule interview rounds and track panel evaluations."
      />
      <InterviewWorkspace />
    </PageContainer>
  );
}
