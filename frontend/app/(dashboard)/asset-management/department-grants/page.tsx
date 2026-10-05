import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetGrantWorkspace } from "@/features/asset/components/asset-grant-workspace";

export default function AssetDepartmentGrantsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Department grants"
        description="Name who keeps assets for a department (custodian). After grant, they log in again and see Custodian Inbox under Assets & licences."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="grants"
          note="Grant → person logs out/in → Assets & licences → Custodian Inbox. Empty inbox is normal until someone requests return/damage."
        />
        <AssetGrantWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
