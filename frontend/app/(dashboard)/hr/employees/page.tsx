import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";

import { EmployeeDashboard } from "@/features/employee/dashboard";

export default function EmployeesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Employees"
        description="Manage employee records across companies, branches and departments."
      />

      <EmployeeDashboard />
    </PageContainer>
  );
}
