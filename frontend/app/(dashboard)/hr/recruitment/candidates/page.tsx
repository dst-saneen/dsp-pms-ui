import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CandidateWorkspace } from "@/features/recruitment/candidates";

export default function CandidatesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Candidates"
        description="People in the hiring pipeline across all applications."
      />
      <CandidateWorkspace />
    </PageContainer>
  );
}
