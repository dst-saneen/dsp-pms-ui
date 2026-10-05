import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { OfferWorkspace } from "@/features/recruitment/offers";

export default function OffersPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Offers"
        description="Prepare, send, and track offers. Convert accepted candidates to employees."
      />
      <OfferWorkspace />
    </PageContainer>
  );
}
