import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DesignationWorkspace } from "@/features/designation";

export default function DesignationPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Designations"
        description="Manage employee roles and organizational titles."
      />
      <DesignationWorkspace />
    </PageContainer>
  );
}
