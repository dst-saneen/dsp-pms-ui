"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { JOB_APPLICATION_STATUS } from "../../types/enums";
import { useJobApplication } from "../../applications/hooks/use-job-applications";
import {
  useConversionPreflight,
  useConvertCandidate,
  useRetryConversionInvitation,
} from "../hooks/use-ready-to-hire";
import type { ConversionResult } from "../types/conversion-preflight";
import { ConvertCandidateDialog } from "./convert-candidate-dialog";
import { ConversionOutcomeCard } from "./conversion-outcome-card";
import { PreflightChecklist } from "./preflight-checklist";

interface ReadyToHirePanelProps {
  applicationId: string;
}

export function ReadyToHirePanel({ applicationId }: ReadyToHirePanelProps) {
  const { hasPermission } = useAuth();
  const canConvertPermission = hasPermission(RECRUITMENT_PERMISSIONS.convert);

  const applicationQuery = useJobApplication(applicationId);
  const preflightQuery = useConversionPreflight(applicationId);
  const convertMutation = useConvertCandidate(applicationId);
  const retryInvitation = useRetryConversionInvitation(applicationId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [outcome, setOutcome] = useState<ConversionResult | null>(null);

  const application = applicationQuery.data;
  const preflight = preflightQuery.data;
  const existingEmployeeId = preflight?.existingEmployeeId;

  if (!application) return null;

  const showPanel =
    application.status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED ||
    application.status === JOB_APPLICATION_STATUS.HIRED;

  if (!showPanel) return null;

  if (applicationQuery.isLoading || preflightQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to hire</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading conversion preflight…</p>
        </CardContent>
      </Card>
    );
  }

  if (preflightQuery.error || !preflight) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ready to hire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-destructive">
            {getApiErrorMessage(
              preflightQuery.error,
              "We could not load the conversion preflight.",
            )}
          </p>
          <Button variant="outline" size="sm" onClick={() => void preflightQuery.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invitationUserId =
    outcome?.userId ?? preflight.existingUserId;
  const invitationEmployeeId =
    outcome?.employeeId ?? existingEmployeeId;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" aria-hidden />
              Ready to hire
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Server preflight must pass before converting this candidate to an employee.
            </p>
          </div>
          {existingEmployeeId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={RECRUITMENT_ROUTES.employeeDetail(existingEmployeeId, "onboarding")}>
                View employee
              </Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <PreflightChecklist
            checks={preflight.checks}
            remediationContext={{
              applicationId,
              jobOpeningId: application.jobOpeningId,
              acceptedOfferId: preflight.acceptedOfferId || undefined,
              candidateId: application.candidateId,
              existingEmployeeId,
              userId: preflight.existingUserId,
            }}
          />

          {(preflight.invitationDeliveryStatus === "FAILED" ||
            outcome?.invitationDeliveryStatus === "FAILED") &&
          invitationEmployeeId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm">
              <p className="text-muted-foreground">
                Employee was created but the user invitation email failed to deliver.
                Retry does not create another employee or invitation.
              </p>
              {canConvertPermission ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retryInvitation.isPending}
                  onClick={() =>
                    retryInvitation.mutate({
                      employeeId: invitationEmployeeId,
                      userId: invitationUserId,
                    })
                  }
                >
                  {retryInvitation.isPending ? "Retrying…" : "Retry invitation email"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {outcome ? (
            <ConversionOutcomeCard
              result={outcome}
              canRetryInvitation={canConvertPermission}
              retryingInvitation={retryInvitation.isPending}
              onRetryInvitation={() =>
                retryInvitation.mutate({
                  employeeId: outcome.employeeId,
                  userId: outcome.userId,
                })
              }
            />
          ) : null}

          {canConvertPermission && preflight.canConvert && !outcome ? (
            <Button disabled={convertMutation.isPending} onClick={() => setDialogOpen(true)}>
              Convert to employee
            </Button>
          ) : null}

          {!canConvertPermission ? (
            <p className="text-sm text-muted-foreground">
              You can review preflight results but cannot convert without convert permission.
            </p>
          ) : null}

          {existingEmployeeId && !preflight.canConvert && !outcome ? (
            <p className="text-sm text-muted-foreground">
              This application was already converted. Continue onboarding from the employee
              record or use the remediation links above.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ConvertCandidateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preflight={preflight}
        loading={convertMutation.isPending}
        onConfirm={async (confirmationNote) => {
          const result = await convertMutation.mutateAsync({
            applicationVersion: preflight.applicationVersion,
            acceptedOfferVersion: preflight.acceptedOfferVersion,
            confirmationNote,
            operationId: crypto.randomUUID(),
          });
          setDialogOpen(false);
          setOutcome(result);
          void preflightQuery.refetch();
        }}
      />
    </>
  );
}
