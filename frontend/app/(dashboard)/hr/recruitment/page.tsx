import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { RecruitmentDashboard } from "@/features/recruitment";

export default function RecruitmentPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Recruitment"
        description="Manage hiring from job openings through employee conversion."
      />
      <RecruitmentDashboard />
    </PageContainer>
  );
}
