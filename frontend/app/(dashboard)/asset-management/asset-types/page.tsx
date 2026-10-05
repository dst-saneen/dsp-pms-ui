import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetTypeWorkspace } from "@/features/asset-type/components/asset-type-workspace";

export default function AssetTypePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Types"
        description="Choose Hardware, Access card, or Software licence. That choice decides whether staff later see an asset or a licence."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="types"
          note="Prerequisite: Categories. Next: create physical Assets or Licence pools from the matching type."
        />
        <AssetTypeWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
