import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { EmployeeAssetWorkspace } from "@/features/employee-asset";

export default function EmployeeAssetsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Assigned to employees"
        description="Hardware with people, and software seats with people."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="employee-assets"
          note="Hardware = laptop. Software seats = Adobe. Employee confirms on My Workspace."
        />
        <EmployeeAssetWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
