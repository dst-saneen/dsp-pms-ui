import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeDocumentTypeWorkspace } from "@/features/employee-document-type/components/employee-document-type-workspace";

export default function EmployeeDocumentTypePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Document Types"
        description="Define required employee document types and their status."
      />
      <EmployeeDocumentTypeWorkspace />
    </PageContainer>
  );
}
