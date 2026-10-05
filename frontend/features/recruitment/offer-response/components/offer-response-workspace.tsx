"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import type { OfferResponseResult } from "../types/offer-response";
import { useOfferResponseInspection } from "../hooks/use-offer-response";
import { useOfferResponseSecurityGuard } from "../hooks/use-offer-response-security-guard";
import { OfferResponseService } from "../services/offer-response-service";
import { OfferResponseActions } from "./offer-response-actions";
import { OfferResponseShell } from "./offer-response-shell";
import { PublicOfferDetails } from "./public-offer-details";

interface OfferResponseWorkspaceProps {
  token?: string | null;
}

function StateMessage({ title, message }: { title: string; message: string }) {
  return (
    <Card role="status" aria-live="polite">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}

const stateTitleMap = {
  INVALID: "Invalid link",
  EXPIRED: "Offer expired",
  REVOKED: "Offer revoked",
  SUPERSEDED: "Offer superseded",
  ALREADY_ACCEPTED: "Already accepted",
  ALREADY_DECLINED: "Already declined",
  VALID: "Review your offer",
} as const;

export function OfferResponseWorkspace({ token }: OfferResponseWorkspaceProps) {
  useOfferResponseSecurityGuard();
  const inspectionQuery = useOfferResponseInspection(token ?? undefined);
  const [completed, setCompleted] = useState<OfferResponseResult | null>(null);

  if (!token?.trim()) {
    return (
      <OfferResponseShell>
        <StateMessage
          title="Invalid link"
          message="This offer response link is missing required information."
        />
      </OfferResponseShell>
    );
  }

  if (inspectionQuery.isLoading) {
    return (
      <OfferResponseShell>
        <p className="text-muted-foreground text-sm">Validating your offer link…</p>
      </OfferResponseShell>
    );
  }

  if (inspectionQuery.error || !inspectionQuery.data) {
    const invalidToken =
      inspectionQuery.data?.state === "INVALID" ||
      (inspectionQuery.error instanceof Error &&
        inspectionQuery.error.message === "OFFER_TOKEN_INVALID");

    return (
      <OfferResponseShell>
        <StateMessage
          title={invalidToken ? "Invalid link" : "Unable to load offer"}
          message={
            invalidToken
              ? "This offer link is invalid or has already been used."
              : "We could not validate this offer link. Please use the link from your email or contact HR."
          }
        />
      </OfferResponseShell>
    );
  }

  const inspection = inspectionQuery.data;

  if (inspection.state !== "VALID") {
    return (
      <OfferResponseShell>
        <StateMessage
          title={stateTitleMap[inspection.state]}
          message={inspection.message}
        />
      </OfferResponseShell>
    );
  }

  if (completed) {
    return (
      <OfferResponseShell>
        <StateMessage
          title={
            completed.state === "ACCEPTED"
              ? "Offer accepted - HR verification pending"
              : "Offer declined"
          }
          message={completed.message}
        />
      </OfferResponseShell>
    );
  }

  return (
    <OfferResponseShell>
      <div className="space-y-6" role="status" aria-live="polite">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {stateTitleMap[inspection.state]}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{inspection.message}</p>
        </div>

        {inspection.offer ? <PublicOfferDetails offer={inspection.offer} /> : null}

        {inspection.canDownloadPdf && inspection.offer && inspection.downloadToken ? (
          <Button
            variant="outline"
            onClick={() => {
              void OfferResponseService.downloadDocument(token, inspection.downloadToken!)
                .then(() => toast.success("Offer PDF download started."))
                .catch((error) =>
                  toast.error(getApiErrorMessage(error, "Offer PDF download is unavailable."))
                );
            }}
          >
            Download offer PDF
          </Button>
        ) : null}

        {inspection.canRespond && inspection.offer ? (
          <OfferResponseActions token={token} inspection={inspection} onCompleted={setCompleted} />
        ) : null}
      </div>
    </OfferResponseShell>
  );
}
