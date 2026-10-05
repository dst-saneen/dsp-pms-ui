import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetWaiverWorkspace } from "@/features/asset/components/asset-waiver-workspace";

export default function AssetWaiversPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Clearance waivers"
        description="Only when someone is leaving and an item cannot be returned — HR asks to skip that item so exit can finish."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="waivers"
          note="Normal day: ignore this page. You only use it during employee exit / separation when a mandatory asset is stuck."
        />
        <AssetWaiverWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
