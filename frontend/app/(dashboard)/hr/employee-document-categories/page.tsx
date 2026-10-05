import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeDocumentCategoryWorkspace } from "@/features/employee-document-category/components/employee-document-category-workspace";

export default function EmployeeDocumentCategoryPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Document Categories"
        description="Organize employee documents into reusable categories."
      />
      <EmployeeDocumentCategoryWorkspace />
    </PageContainer>
  );
}
