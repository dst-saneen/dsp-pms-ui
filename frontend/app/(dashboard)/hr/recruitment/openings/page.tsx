import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { JobOpeningWorkspace } from "@/features/recruitment/openings";

export default function JobOpeningsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Job Openings"
        description="Create openings with headcount, hiring manager, and evaluation criteria."
      />
      <JobOpeningWorkspace />
    </PageContainer>
  );
}
