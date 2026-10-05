import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { CompanyWorkspace } from "@/features/company";

export default function CompaniesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Companies"
        description="Manage legal entities within your company groups."
      />
      <CompanyWorkspace />
    </PageContainer>
  );
}
