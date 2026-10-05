import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SeparationDetailWorkspace } from "@/features/hr-operations";

export default async function EmployeeSeparationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageContainer>
      <PageHeader title="Employee separation" description="Approval evidence, Department clearance, and final completion." />
      <SeparationDetailWorkspace separationId={id} />
    </PageContainer>
  );
}
