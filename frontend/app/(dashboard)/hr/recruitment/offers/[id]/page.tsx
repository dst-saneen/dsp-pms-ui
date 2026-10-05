"use client";

import { useParams } from "next/navigation";

import { OfferDetail } from "@/features/recruitment/offers";

export default function OfferDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return <OfferDetail offerId={id} />;
}
