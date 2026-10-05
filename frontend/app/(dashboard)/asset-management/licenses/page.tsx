import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetLicenseWorkspace } from "@/features/asset/components/asset-license-workspace";

export default function AssetLicensesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Licences"
        description="Software seats (Adobe, etc.). Open a pool → Give seat to a person."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="licenses"
          note="Pools listed below. View people → Give seat. Same seats also show under Assigned to employees → Software seats."
        />
        <AssetLicenseWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
