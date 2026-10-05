import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ShiftWorkspace } from "@/features/shift";

export default function ShiftPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Shifts"
        description="Configure working schedules and active shift patterns."
      />
      <ShiftWorkspace />
    </PageContainer>
  );
}
