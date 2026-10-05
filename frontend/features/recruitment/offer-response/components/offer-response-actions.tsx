"use client";

import { useState, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

import { SecureFileUploadField } from "@/components/file-upload/secure-file-upload-field";
import type { UploadSessionResponse } from "@/components/file-upload/secure-file-upload-field";
import type { OfferResponseInspection, OfferResponseResult } from "../types/offer-response";
import {
  getResponseErrorMessage,
  useDeclineOffer,
} from "../hooks/use-offer-response";
import {
  offerAcceptanceSchema,
  type OfferAcceptanceFormValues,
} from "../validation/offer-response-schema";
import { DeclineOfferDialog } from "./decline-offer-dialog";
import { OfferResponseService } from "../services/offer-response-service";

interface OfferResponseActionsProps {
  token: string;
  inspection: OfferResponseInspection;
  onCompleted: (result: OfferResponseResult) => void;
}

export function OfferResponseActions({
  token,
  inspection,
  onCompleted,
}: OfferResponseActionsProps) {
  const declineOffer = useDeclineOffer(token);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [signedSessionId, setSignedSessionId] = useState<string | null>(null);
  const [signedFileObjectId, setSignedFileObjectId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OfferAcceptanceFormValues>({
    resolver: zodResolver(offerAcceptanceSchema),
    defaultValues: {
      legalName: "",
      acknowledgement: false,
    },
  });

  const acknowledgement = useWatch({
    control: form.control,
    name: "acknowledgement",
  });

  const isBusy = declineOffer.isPending || isSubmitting;

  const handleSignedFileReady = useCallback((sessionId: string, fileObjectId: string) => {
    setSignedSessionId(sessionId);
    setSignedFileObjectId(fileObjectId);
  }, []);

  const createSession = useCallback(
    async (params: {
      fileName: string;
      declaredMimeType: string;
      sizeBytes: number;
      checksumSha256: string;
      operationId: string;
    }) => {
      const session = await OfferResponseService.createSignedOfferUploadSession(token, params);
      return {
        id: session.id,
        version: 0,
        status: session.status,
        sessionToken: session.sessionToken,
        upload: session.upload,
        scan: { status: 'NOT_STARTED', safeErrorCode: null },
        fileObjectId: null,
        allowedActions: ['UPLOAD', 'CANCEL'],
      };
    },
    [token],
  );

  const finalizeSession = useCallback(
    async (sessionId: string, sessionToken?: string) => {
      return (await OfferResponseService.finalizeSignedOfferUploadSession(
        token,
        sessionId,
        sessionToken,
      )) as unknown as UploadSessionResponse;
    },
    [token],
  );

  const pollSession = useCallback(
    async (sessionId: string, sessionToken?: string) => {
      return (await OfferResponseService.pollUploadSession(
        token,
        sessionId,
        sessionToken,
      )) as unknown as UploadSessionResponse;
    },
    [token],
  );

  const handleAccept = async (values: OfferAcceptanceFormValues) => {
    if (!inspection.offer) return;

    if (!signedSessionId || !signedFileObjectId) {
      toast.error("Please upload your signed offer PDF before accepting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await OfferResponseService.acceptWithSignedDocument(token, {
        legalName: values.legalName,
        declarationAccepted: true,
        uploadSessionId: signedSessionId,
        expectedOfferVersion: inspection.responseVersion ?? 1,
        operationId: crypto.randomUUID(),
      });
      onCompleted(result);
    } catch (error) {
      toast.error(getResponseErrorMessage(error, "Unable to accept the offer."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async (values: {
    legalName: string;
    acknowledgement: boolean;
    reason?: string;
  }) => {
    if (!inspection.responseVersion) return;

    try {
      const result = await declineOffer.mutateAsync({
        legalName: values.legalName,
        acknowledgement: values.acknowledgement,
        reason: values.reason,
        responseVersion: inspection.responseVersion,
      });
      setDeclineOpen(false);
      onCompleted(result);
    } catch (error) {
      toast.error(getResponseErrorMessage(error, "Unable to decline the offer."));
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your response</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={form.handleSubmit(handleAccept)}>
            <div className="space-y-2">
              <RequiredLabel>Full legal name</RequiredLabel>
              <Input {...form.register("legalName")} autoComplete="name" disabled={isBusy} />
              {form.formState.errors.legalName ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.legalName.message}
                </p>
              ) : null}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border"
                checked={Boolean(acknowledgement)}
                disabled={isBusy}
                onChange={(event) =>
                  form.setValue("acknowledgement", event.target.checked, {
                    shouldValidate: true,
                  })
                }
              />
              <span>
                I have reviewed the offer terms and acknowledge that accepting creates a
                binding commitment subject to the stated conditions.
              </span>
            </label>
            {form.formState.errors.acknowledgement ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.acknowledgement.message}
              </p>
            ) : null}

            <div className="rounded-md border border-blue-100 bg-blue-50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                <FileText className="h-4 w-4" />
                Upload your signed offer PDF
              </div>
              <p className="text-xs text-blue-600">
                Please download the offer, sign it, and upload the signed PDF below before accepting.
              </p>
              {signedSessionId ? (
                <Alert className="border-green-200 bg-green-50 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 text-sm ml-2">
                    Signed PDF passed malware scanning. HR still needs to verify your signature after you accept.
                  </AlertDescription>
                </Alert>
              ) : (
                <SecureFileUploadField
                  label=""
                  accept=".pdf"
                  maxSizeMb={10}
                  onSessionReady={handleSignedFileReady}
                  createSession={createSession}
                  finalizeSession={finalizeSession}
                  pollSession={pollSession}
                  disabled={isBusy}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={isBusy || !signedSessionId}
                title={!signedSessionId ? "Upload signed offer PDF first" : undefined}
              >
                {isSubmitting ? "Submitting…" : "Accept offer"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isBusy}
                onClick={() => setDeclineOpen(true)}
              >
                Decline offer
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <DeclineOfferDialog
        open={declineOpen}
        onOpenChange={setDeclineOpen}
        loading={declineOffer.isPending}
        onConfirm={handleDecline}
      />
    </>
  );
}
