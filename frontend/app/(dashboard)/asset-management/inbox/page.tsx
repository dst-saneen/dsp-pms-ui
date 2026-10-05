import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { AssetInboxPanel } from "@/features/asset/components/asset-inbox-panel";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";

export default function AssetInboxPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Custodian inbox"
        description="Pending return / damage / lost requests for departments you custodian. Approve and reject both need a real note."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="inbox"
          note="Only act if you are the department custodian. Employee acknowledgement is on My Workspace."
        />
        <WorkspaceShell>
          <AssetInboxPanel alwaysShow />
        </WorkspaceShell>
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
