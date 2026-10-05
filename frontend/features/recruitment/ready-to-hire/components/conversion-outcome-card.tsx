"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { RECRUITMENT_ROUTES } from "../../constants/routes";
import type { ConversionResult } from "../types/conversion-preflight";
import {
  employeeOnboardingHref,
  usersAdminHref,
} from "../utils/conversion-remediation";

interface ConversionOutcomeCardProps {
  result: ConversionResult;
  onRetryInvitation?: () => void;
  retryingInvitation?: boolean;
  canRetryInvitation?: boolean;
}

function invitationLabel(status: ConversionResult["invitationDeliveryStatus"]) {
  switch (status) {
    case "DELIVERED":
      return "Invitation delivered";
    case "FAILED":
      return "Invitation failed";
    default:
      return "Invitation pending";
  }
}

export function ConversionOutcomeCard({
  result,
  onRetryInvitation,
  retryingInvitation,
  canRetryInvitation,
}: ConversionOutcomeCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {result.isExistingConversion
            ? "Conversion already recorded"
            : "Conversion complete"}
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {result.isExistingConversion
            ? "Repeat submit returned the existing employee and invitation — no duplicate was created."
            : "Employee, user invitation, and onboarding handoff are ready."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Employee</p>
            <p className="font-medium">
              {result.employeeCode !== "—"
                ? result.employeeCode
                : result.employeeId.slice(0, 8)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">User / invitation</p>
            <p className="font-medium">
              {invitationLabel(result.invitationDeliveryStatus)}
              {result.userId ? ` · user ${result.userId.slice(0, 8)}…` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={RECRUITMENT_ROUTES.employeeDetail(result.employeeId, "onboarding")}>
              Open employee onboarding
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={RECRUITMENT_ROUTES.employeeDetail(result.employeeId, "career")}>
              Career record
            </Link>
          </Button>
          {result.employeeOnboardingId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={employeeOnboardingHref(result.employeeOnboardingId)}>
                Onboarding workspace
              </Link>
            </Button>
          ) : null}
          {result.userId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={usersAdminHref(result.userId)}>User administration</Link>
            </Button>
          ) : null}
          {canRetryInvitation &&
          result.invitationDeliveryStatus === "FAILED" &&
          onRetryInvitation ? (
            <Button
              variant="outline"
              size="sm"
              disabled={retryingInvitation}
              onClick={onRetryInvitation}
            >
              {retryingInvitation ? "Retrying…" : "Retry invitation email"}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
