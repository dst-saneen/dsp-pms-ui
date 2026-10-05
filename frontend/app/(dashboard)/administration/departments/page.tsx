import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DepartmentWorkspace } from "@/features/department";

export default function DepartmentPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Departments"
        description="Manage departments within each company and branch."
      />
      <DepartmentWorkspace />
    </PageContainer>
  );
}
