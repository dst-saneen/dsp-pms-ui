"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { useManagers } from "@/features/lookups/hooks/use-lookups";
import { DeliveryReasonDialog } from "@/features/delivery/components/delivery-reason-dialog";

import { OfferStatusBadge } from "../../components/offer-status-badge";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { isRecruitmentMockEnabled } from "../../constants/feature-flags";
import { JOB_APPLICATION_STATUS, JOB_OFFER_STATUS } from "../../types/enums";
import { useJobApplication } from "../../applications/hooks/use-job-applications";
import { OfferActionDialog } from "../dialogs/offer-action-dialog";
import {
  useApplicationOffers,
  useCreateOfferDraft,
  useRetryOfferDelivery,
  useReviseOffer,
  useRevokeOffer,
  useSendOffer,
  useUpdateOfferDraft,
} from "../hooks/use-offers";
import type { JobOffer } from "../types/job-offer";
import type { OfferDraftFormValues } from "../validation/offer-schema";
import { OfferResponseService } from "../../offer-response/services/offer-response-service";
import { CandidateOfferDeliveryNotice } from "./candidate-offer-response-link";
import { OfferComposerForm } from "./offer-composer-form";
import { OfferVersionHistory } from "./offer-version-history";
import { ReadyToHirePanel } from "../../ready-to-hire/components/ready-to-hire-panel";
import { OfferSignatureVerificationPanel } from "./offer-signature-verification-panel";
import { formatOfferDeliveryStatus, isOfferDeliverySent } from "../utils/offer-delivery";

interface ApplicationOfferPanelProps {
  applicationId: string;
  /** When set, highlights this offer version in the lifecycle. */
  focusOfferId?: string;
  /**
   * `page` — full staged composer/lifecycle.
   * `embedded` — summary + deep link into the full offer page.
   */
  layout?: "page" | "embedded";
}

function MockOfferResponseLink({ offerId }: { offerId: string }) {
  if (!isRecruitmentMockEnabled()) return null;

  const path = OfferResponseService.getMockResponsePath(offerId);
  if (!path) return null;

  return (
    <a href={path} className="text-primary text-xs font-medium hover:underline">
      Open mock candidate response link (dev mock only)
    </a>
  );
}

function StageCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ApplicationOfferPanel({
  applicationId,
  focusOfferId,
  layout = "page",
}: ApplicationOfferPanelProps) {
  const { hasPermission } = useAuth();
  const canOffer = hasPermission(RECRUITMENT_PERMISSIONS.offer);
  const canVerify = hasPermission(RECRUITMENT_PERMISSIONS.verify);

  const applicationQuery = useJobApplication(applicationId);
  const offersQuery = useApplicationOffers(applicationId);
  const createDraft = useCreateOfferDraft(applicationId);
  const updateDraft = useUpdateOfferDraft(applicationId);
  const sendOffer = useSendOffer(applicationId);
  const retryDelivery = useRetryOfferDelivery(applicationId);
  const revokeOffer = useRevokeOffer(applicationId);
  const reviseOffer = useReviseOffer(applicationId);

  const [actionMode, setActionMode] = useState<"preview" | "send" | "revoke" | null>(null);
  const [actionOffer, setActionOffer] = useState<JobOffer | null>(null);
  const [retryOffer, setRetryOffer] = useState<JobOffer | null>(null);

  const application = applicationQuery.data;
  const offers = useMemo(() => offersQuery.data ?? [], [offersQuery.data]);
  const managersQuery = useManagers(application?.companyId);

  const activeDraft = useMemo(
    () => offers.find((offer) => offer.status === JOB_OFFER_STATUS.DRAFT) ?? null,
    [offers],
  );

  const sentOffer = useMemo(
    () => offers.find((offer) => offer.status === JOB_OFFER_STATUS.SENT) ?? null,
    [offers],
  );

  const respondedOffer = useMemo(
    () =>
      offers.find(
        (offer) =>
          offer.status === JOB_OFFER_STATUS.ACCEPTED ||
          offer.status === JOB_OFFER_STATUS.DECLINED,
      ) ?? null,
    [offers],
  );

  const signatureOffer = useMemo(
    () =>
      offers.find((offer) => offer.status === JOB_OFFER_STATUS.SENT) ??
      offers.find((offer) => offer.status === JOB_OFFER_STATUS.ACCEPTED) ??
      null,
    [offers],
  );

  const primaryOffer =
    (focusOfferId ? offers.find((offer) => offer.id === focusOfferId) : null) ??
    activeDraft ??
    sentOffer ??
    respondedOffer ??
    offers[0] ??
    null;

  const isBusy =
    createDraft.isPending ||
    updateDraft.isPending ||
    sendOffer.isPending ||
    retryDelivery.isPending ||
    revokeOffer.isPending ||
    reviseOffer.isPending;

  if (applicationQuery.isLoading || offersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading offer details…</p>;
  }

  if (!application) {
    return <p className="text-muted-foreground text-sm">Application not found.</p>;
  }

  const canPrepareOffer =
    canOffer && application.status === JOB_APPLICATION_STATUS.SELECTED && !activeDraft;

  const handleSaveDraft = async (values: OfferDraftFormValues) => {
    if (!activeDraft) return;

    await updateDraft.mutateAsync({
      id: activeDraft.id,
      data: {
        ...values,
        version: activeDraft.version,
        reportingManagerName: managersQuery.data?.find(
          (item) => item.id === values.reportingManagerEmployeeId,
        )?.name,
      },
    });
  };

  if (layout === "embedded") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">
              Compose, send, and track offers on the dedicated offer page.
            </p>
            {primaryOffer ? (
              <p className="mt-1 text-sm">
                Current: v{primaryOffer.versionNumber} ·{" "}
                <OfferStatusBadge status={primaryOffer.status} />
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground text-sm">No offer versions yet.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canPrepareOffer ? (
              <Button disabled={isBusy} onClick={() => createDraft.mutate(undefined)}>
                Prepare offer
              </Button>
            ) : null}
            {primaryOffer ? (
              <Button asChild>
                <Link href={RECRUITMENT_ROUTES.offers.detail(primaryOffer.id)}>
                  Open offer detail
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {sentOffer ? (
          <CandidateOfferDeliveryNotice
            delivery={sentOffer.delivery}
            candidateResponseUrl={sentOffer.candidateResponseUrl}
          />
        ) : null}

        <ReadyToHirePanel applicationId={applicationId} />

        <Link
          href={RECRUITMENT_ROUTES.offers.list}
          className="text-primary text-sm font-medium hover:underline"
        >
          View all offers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Staged offer lifecycle: compose &amp; send approval, delivery, candidate
          response, then signature verification.
        </p>
        {canPrepareOffer ? (
          <Button disabled={isBusy} onClick={() => createDraft.mutate(undefined)}>
            Prepare offer
          </Button>
        ) : null}
      </div>

      {application.status !== JOB_APPLICATION_STATUS.SELECTED &&
      application.status !== JOB_APPLICATION_STATUS.OFFER_SENT &&
      application.status !== JOB_APPLICATION_STATUS.OFFER_ACCEPTED &&
      application.status !== JOB_APPLICATION_STATUS.OFFER_DECLINED ? (
        <p className="text-muted-foreground text-sm">
          Offers can be prepared after the hiring manager selects the candidate.
        </p>
      ) : null}

      <StageCard
        title="1. Compose & send approval"
        description="Edit the draft, preview the package, and confirm before sending. Sending reserves headcount."
      >
        {activeDraft ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Draft · Version {activeDraft.versionNumber}
              </p>
              <OfferStatusBadge status={activeDraft.status} />
            </div>
            <OfferComposerForm
              offer={activeDraft}
              saving={updateDraft.isPending}
              onSave={handleSaveDraft}
            />
            <div className="flex flex-wrap gap-2">
              {activeDraft.allowedActions.canPreview ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionOffer(activeDraft);
                    setActionMode("preview");
                  }}
                >
                  Preview
                </Button>
              ) : null}
              {activeDraft.allowedActions.canSend ? (
                <Button
                  disabled={isBusy}
                  onClick={() => {
                    setActionOffer(activeDraft);
                    setActionMode("send");
                  }}
                >
                  Approve & send
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No draft awaiting send approval.
            {canPrepareOffer
              ? " Use Prepare offer to start a new draft."
              : ""}
          </p>
        )}
      </StageCard>

      <StageCard
        title="2. Delivery"
        description="Track email delivery status. Failed sends require a retry reason and keep attempt history."
      >
        {sentOffer ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  Sent · Version {sentOffer.versionNumber}
                </p>
                <p className="text-muted-foreground text-sm">
                  Delivery: {formatOfferDeliveryStatus(sentOffer.delivery.status)}
                  {sentOffer.delivery.failureReason
                    ? ` · ${sentOffer.delivery.failureReason}`
                    : ""}
                </p>
              </div>
              <OfferStatusBadge status={sentOffer.status} />
            </div>
            <CandidateOfferDeliveryNotice
              delivery={sentOffer.delivery}
              candidateResponseUrl={sentOffer.candidateResponseUrl}
            />
            <OfferComposerForm offer={sentOffer} readOnly onSave={() => undefined} />
            <div className="flex flex-wrap gap-2">
              {sentOffer.allowedActions.canPreview ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionOffer(sentOffer);
                    setActionMode("preview");
                  }}
                >
                  Preview
                </Button>
              ) : null}
              {canOffer &&
              (sentOffer.allowedActions.canRetryDelivery ||
                sentOffer.delivery.retryAvailable) ? (
                <Button
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setRetryOffer(sentOffer)}
                >
                  Retry delivery
                </Button>
              ) : null}
              {canOffer && sentOffer.allowedActions.canRevoke ? (
                <Button
                  variant="destructive"
                  disabled={isBusy}
                  onClick={() => {
                    setActionOffer(sentOffer);
                    setActionMode("revoke");
                  }}
                >
                  Revoke
                </Button>
              ) : null}
              {canOffer && sentOffer.allowedActions.canRevise ? (
                <Button
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => reviseOffer.mutate(sentOffer.id)}
                >
                  Create revised version
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm">
                <Link href="/hr/recruitment/delivery">Open delivery queue</Link>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No sent offer is awaiting delivery yet.
          </p>
        )}
      </StageCard>

      <StageCard
        title="3. Candidate response"
        description="Wait for accept or decline from the candidate link. Replayed or expired links fail safely."
      >
        {sentOffer && isOfferDeliverySent(sentOffer.delivery.status) ? (
          <div className="space-y-2">
            <p className="text-sm">
              Awaiting candidate response on offer v{sentOffer.versionNumber}.
            </p>
            <MockOfferResponseLink offerId={sentOffer.id} />
          </div>
        ) : null}
        {respondedOffer ? (
          <div className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                Version {respondedOffer.versionNumber}
              </span>
              <OfferStatusBadge status={respondedOffer.status} />
            </div>
            <p className="text-muted-foreground">
              {respondedOffer.responseAt
                ? `Responded ${new Date(respondedOffer.responseAt).toLocaleString()}`
                : "Response recorded."}
            </p>
          </div>
        ) : null}
        {!sentOffer && !respondedOffer ? (
          <p className="text-muted-foreground text-sm">
            Candidate response appears after a successful send.
          </p>
        ) : null}
      </StageCard>

      <StageCard
        title="4. Signature verification"
        description="Verify or reject the signed offer package after acceptance (or while sent, when required)."
      >
        {signatureOffer ? (
          <OfferSignatureVerificationPanel
            jobOfferId={signatureOffer.id}
            offerVersion={signatureOffer.version}
            canVerify={canVerify}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            Signature verification becomes available after the offer is sent.
          </p>
        )}
      </StageCard>

      {!canOffer ? (
        <p className="text-muted-foreground text-sm">
          You can view offer history but cannot compose or send offers without offer
          permission.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Version history</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferVersionHistory offers={offers} />
        </CardContent>
      </Card>

      <ReadyToHirePanel applicationId={applicationId} />

      <Link
        href={RECRUITMENT_ROUTES.offers.list}
        className="text-primary text-sm font-medium hover:underline"
      >
        View all offers
      </Link>

      <OfferActionDialog
        open={actionMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActionMode(null);
            setActionOffer(null);
          }
        }}
        mode={actionMode ?? "preview"}
        offer={actionOffer}
        loading={sendOffer.isPending || revokeOffer.isPending}
        onConfirm={async (values) => {
          if (!actionOffer || !actionMode) return;

          if (actionMode === "send") {
            await sendOffer.mutateAsync({
              id: actionOffer.id,
              data: { version: actionOffer.version },
            });
          } else if (actionMode === "revoke" && values) {
            await revokeOffer.mutateAsync({
              id: actionOffer.id,
              data: {
                version: actionOffer.version,
                reason: values.reason,
              },
            });
          }

          setActionMode(null);
          setActionOffer(null);
        }}
      />

      <DeliveryReasonDialog
        open={retryOffer !== null}
        onOpenChange={(open) => {
          if (!open) setRetryOffer(null);
        }}
        mode="retry"
        loading={retryDelivery.isPending}
        description="Record why this offer email is being retried. A new candidate link replaces any prior unconsumed link."
        onConfirm={async ({ reason }) => {
          if (!retryOffer) return;
          await retryDelivery.mutateAsync({
            id: retryOffer.id,
            data: { version: retryOffer.version, reason },
          });
          setRetryOffer(null);
        }}
      />
    </div>
  );
}
