import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetTransferWorkspace } from "@/features/asset/components/asset-transfer-workspace";

export default function AssetTransfersPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Transfers"
        description="Move a laptop/phone from one department to another. Not for giving an item to a person — that is Assign."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="transfers"
          note="Start from Assets → open an item → Transfer. Destination custodian Accepts here. Licences do not use this page."
        />
        <AssetTransferWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
