"use client";

import { OfferStatusBadge } from "../../components/offer-status-badge";
import type { JobOffer } from "../types/job-offer";
import { formatOfferDeliveryStatus } from "../utils/offer-delivery";

function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

interface OfferVersionHistoryProps {
  offers: JobOffer[];
}

export function OfferVersionHistory({ offers }: OfferVersionHistoryProps) {
  if (offers.length === 0) {
    return <p className="text-muted-foreground text-sm">No offer versions yet.</p>;
  }

  return (
    <div className="space-y-3">
      {offers.map((offer) => (
        <div key={offer.id} className="rounded-xl border p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Version {offer.versionNumber}</p>
            <OfferStatusBadge status={offer.status} />
          </div>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Updated:</span>{" "}
              {formatDateTime(offer.updatedAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Delivery:</span>{" "}
              {formatOfferDeliveryStatus(offer.delivery.status)}
            </p>
            {offer.sentAt ? (
              <p>
                <span className="text-muted-foreground">Sent:</span> {formatDateTime(offer.sentAt)}
              </p>
            ) : null}
            {offer.revokedAt ? (
              <p>
                <span className="text-muted-foreground">Revoked:</span>{" "}
                {formatDateTime(offer.revokedAt)}
              </p>
            ) : null}
            {offer.responseAt ? (
              <p>
                <span className="text-muted-foreground">Response:</span>{" "}
                {formatDateTime(offer.responseAt)}
              </p>
            ) : null}
            {offer.supersededByVersion ? (
              <p>
                <span className="text-muted-foreground">Superseded by:</span> v
                {offer.supersededByVersion}
              </p>
            ) : null}
          </div>
          {offer.delivery.failureReason ? (
            <p className="text-destructive mt-2">{offer.delivery.failureReason}</p>
          ) : null}
          {offer.headcountImpact ? (
            <p className="text-muted-foreground mt-2">
              Headcount reserved: {offer.headcountImpact.reservedBefore} →{" "}
              {offer.headcountImpact.reservedAfter} · Remaining:{" "}
              {offer.headcountImpact.remainingBefore} → {offer.headcountImpact.remainingAfter}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
