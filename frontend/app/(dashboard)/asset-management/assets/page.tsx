import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetWorkspace } from "@/features/asset/components/asset-workspace";

export default function Asset() {
  return (
    <PageContainer>
      <PageHeader
        title="Assets"
        description="Physical items only: hardware, furniture, and access cards. Software licences are on the Licences page."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="assets"
          note="History is readable (date, action, actor, reason). Assign from here; employee acknowledges on My Workspace."
        />
        <AssetWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
