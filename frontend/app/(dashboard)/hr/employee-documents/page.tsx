import { Suspense } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { EmployeeDocumentWorkspace } from "@/features/employee-document/components/employee-document-workspace";

export default function EmployeeDocumentPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Employee Documents"
        description="Review and manage employee document records."
      />
      <Suspense fallback={<div className="p-6">Loading documents...</div>}>
        <EmployeeDocumentWorkspace />
      </Suspense>
    </PageContainer>
  );
}
