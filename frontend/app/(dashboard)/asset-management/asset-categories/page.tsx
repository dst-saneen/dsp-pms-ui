import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { AssetSetupPathBanner } from "@/features/asset/components/asset-setup-path-banner";
import { AssetCategoryWorkspace } from "@/features/asset-category/components/asset-category-workspace";

export default function AssetCategoriesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Categories"
        description="Shared groups for both physical assets and software licences."
      />
      <ModuleCapabilityGate capability="assetsNav">
        <AssetSetupPathBanner
          current="categories"
          note="Next: create Types under each category, then physical Assets or Licence pools."
        />
        <AssetCategoryWorkspace />
      </ModuleCapabilityGate>
    </PageContainer>
  );
}
