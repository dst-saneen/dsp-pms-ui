"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";

import { OfferStatusBadge } from "../../components/offer-status-badge";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { recruitmentKeys } from "../../hooks/query-keys";
import { OfferService } from "../services/offer-service";
import { ApplicationOfferPanel } from "./application-offer-panel";

interface OfferDetailProps {
  offerId: string;
}

export function OfferDetail({ offerId }: OfferDetailProps) {
  const offerQuery = useQuery({
    queryKey: recruitmentKeys.offers.detail(offerId),
    queryFn: () => OfferService.getById(offerId),
  });

  const offer = offerQuery.data;

  if (offerQuery.isLoading) {
    return (
      <PageContainer>
        <p className="text-sm text-muted-foreground">Loading offer…</p>
      </PageContainer>
    );
  }

  if (!offer) {
    return (
      <PageContainer>
        <PageHeader title="Offer not found" />
        <Button asChild variant="outline">
          <Link href={RECRUITMENT_ROUTES.offers.list}>Back to offers</Link>
        </Button>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={`Offer v${offer.versionNumber} · ${offer.candidateName}`}
        description={`${offer.applicationNumber} · ${offer.openingCode} · ${offer.openingTitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusBadge status={offer.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={RECRUITMENT_ROUTES.offers.list}>All offers</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={RECRUITMENT_ROUTES.applications.detail(offer.jobApplicationId)}>
                Application
              </Link>
            </Button>
          </div>
        }
      />
      <ApplicationOfferPanel
        applicationId={offer.jobApplicationId}
        focusOfferId={offer.id}
        layout="page"
      />
    </PageContainer>
  );
}
