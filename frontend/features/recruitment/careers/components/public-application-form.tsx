"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import {
  PUBLIC_MAX_SUPPORTING_DOCUMENTS,
  PUBLIC_PRIVACY_NOTICE,
  PUBLIC_PRIVACY_RETENTION_LINK,
} from "../constants/public-careers-content";
import {
  useSubmitPublicApplication,
} from "../hooks/use-public-careers";
import type {
  PublicApplicationReceipt,
  PublicJobOpeningDetail,
} from "../types/public-careers";
import {
  validatePublicDocument,
  validateSupportingDocuments,
} from "../utils/file-validation";
import {
  classifyPublicApplicationError,
  type PublicApplyErrorInfo,
} from "../utils/public-application-errors";
import { toSafePublicReceipt } from "../utils/safe-public-receipt";
import {
  publicApplicationSchema,
  type PublicApplicationFormValues,
} from "../validation/public-application-schema";
import { ApplicationSuccessReceipt } from "./application-success-receipt";
import { PublicDocumentUploadField } from "./public-document-upload-field";
import { isTurnstileRequired, TurnstileField } from "./turnstile-field";

const STEPS = [
  { id: "contact", label: "Your details" },
  { id: "documents", label: "Documents" },
  { id: "review", label: "Review & submit" },
] as const;

interface PublicApplicationFormProps {
  companyCode: string;
  opening: PublicJobOpeningDetail;
}

function createIdempotencyKey(openingCode: string) {
  const storageKey = `careers-idempotency-${openingCode
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")}`;

  if (typeof window === "undefined") return crypto.randomUUID();

  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const created = crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, created);
  return created;
}

export function PublicApplicationForm({
  companyCode,
  opening,
}: PublicApplicationFormProps) {
  const submitMutation = useSubmitPublicApplication(
    companyCode,
    opening.openingCode,
  );
  const headingId = useId();
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PublicApplicationReceipt | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<PublicApplyErrorInfo | null>(
    null,
  );

  const idempotencyKey = useMemo(
    () => createIdempotencyKey(opening.openingCode),
    [opening.openingCode],
  );

  const form = useForm<PublicApplicationFormValues>({
    resolver: zodResolver(publicApplicationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      coverNote: "",
      privacyAcknowledged: false,
      website: "",
    },
    mode: "onTouched",
  });

  const privacyAcknowledged = useWatch({
    control: form.control,
    name: "privacyAcknowledged",
  });
  const watchedValues = useWatch({ control: form.control });

  const currentStep = STEPS[stepIndex];

  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [stepIndex]);

  if (receipt) {
    return (
      <ApplicationSuccessReceipt
        receipt={receipt}
        openingTitle={opening.title}
      />
    );
  }

  if (!opening.canApply) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        {opening.closingMessage ??
          "This opening is not accepting applications right now."}
      </p>
    );
  }

  const clearRecovery = () => {
    setApplyError(null);
    setSubmitError(null);
    setFileError(null);
  };

  const goNextFromContact = async () => {
    const valid = await form.trigger(["firstName", "lastName", "email"]);
    if (!valid) return;
    setStepIndex(1);
  };

  const goNextFromDocuments = () => {
    setFileError(null);
    const cvError = validatePublicDocument(cvFile as File, {
      required: true,
      label: "CV",
    });
    if (cvError || !cvFile) {
      setFileError(cvError ?? "CV is required.");
      return;
    }

    const supportingError = validateSupportingDocuments(supportingFiles);
    if (supportingError) {
      setFileError(supportingError);
      return;
    }

    setStepIndex(2);
  };

  const handleSubmit = async (values: PublicApplicationFormValues) => {
    setSubmitError(null);
    setFileError(null);
    setApplyError(null);

    const cvError = validatePublicDocument(cvFile as File, {
      required: true,
      label: "CV",
    });
    if (cvError || !cvFile) {
      setFileError(cvError ?? "CV is required.");
      setStepIndex(1);
      return;
    }

    const supportingError = validateSupportingDocuments(supportingFiles);
    if (supportingError) {
      setFileError(supportingError);
      setStepIndex(1);
      return;
    }

    if (isTurnstileRequired() && !turnstileToken) {
      setSubmitError("Please complete the verification challenge.");
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        mobile: values.mobile?.trim() || undefined,
        coverNote: values.coverNote?.trim() || undefined,
        privacyAcknowledged: true,
        honeypot: values.website,
        turnstileToken: turnstileToken ?? undefined,
        idempotencyKey,
        cv: {
          fileName: cvFile.name,
          fileSize: cvFile.size,
        },
        cvFile,
        supportingDocuments: supportingFiles.map((file) => ({
          fileName: file.name,
          fileSize: file.size,
        })),
        supportingFiles,
      });
      setReceipt(toSafePublicReceipt(result));
    } catch (error) {
      const classified = classifyPublicApplicationError(
        error,
        "We could not submit your application. Please try again.",
      );
      setApplyError(classified);
      setSubmitError(classified.message);

      if (
        classified.recovery === "replace_cv" ||
        classified.recovery === "wait_and_retry"
      ) {
        setStepIndex(1);
      }

      if (classified.recovery === "opening_closed") {
        // Stay on review; message explains the opening is closed.
      }
    }
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Application steps">
        <ol className="flex flex-wrap gap-2">
          {STEPS.map((step, index) => {
            const isCurrent = index === stepIndex;
            const isComplete = index < stepIndex;
            return (
              <li key={step.id}>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                    isCurrent && "border-primary bg-primary/5 text-primary",
                    isComplete && "border-success/40 bg-success/5 text-success",
                    !isCurrent && !isComplete && "text-muted-foreground",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span aria-hidden="true">{index + 1}</span>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      <form
        className="space-y-4"
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        aria-labelledby={headingId}
      >
        <h2
          id={headingId}
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-base font-semibold outline-none"
        >
          {currentStep.label}
        </h2>

        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <Input
            id="website"
            tabIndex={-1}
            autoComplete="off"
            {...form.register("website")}
          />
        </div>

        {currentStep.id === "contact" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>First name</RequiredLabel>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  aria-required="true"
                  {...form.register("firstName")}
                />
                {form.formState.errors.firstName ? (
                  <p className="text-destructive text-sm" role="alert">
                    {form.formState.errors.firstName.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <RequiredLabel>Last name</RequiredLabel>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  aria-required="true"
                  {...form.register("lastName")}
                />
                {form.formState.errors.lastName ? (
                  <p className="text-destructive text-sm" role="alert">
                    {form.formState.errors.lastName.message}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <RequiredLabel>Email</RequiredLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-required="true"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-destructive text-sm" role="alert">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label htmlFor="mobile" className="text-sm font-medium">
                  Mobile
                </label>
                <Input
                  id="mobile"
                  autoComplete="tel"
                  {...form.register("mobile")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="coverNote" className="text-sm font-medium">
                Cover note
              </label>
              <Textarea
                id="coverNote"
                rows={4}
                {...form.register("coverNote")}
              />
            </div>
          </div>
        ) : null}

        {currentStep.id === "documents" ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Upload a CV in PDF, DOC, or DOCX format (max 10 MB). Files are
              scanned for malware before your application is accepted.
            </p>

            <PublicDocumentUploadField
              label="CV"
              required
              hint="PDF, DOC, or DOCX · up to 10 MB · required"
              file={cvFile}
              error={fileError && !supportingFiles.length ? fileError : null}
              scanStatus={applyError?.scanStatus ?? null}
              safeErrorCode={applyError?.safeErrorCode ?? null}
              disabled={submitMutation.isPending}
              onFileChange={(next) => {
                setCvFile(next);
                clearRecovery();
              }}
              onClearRecovery={clearRecovery}
            />

            <PublicDocumentUploadField
              label="Supporting documents"
              hint={`Optional · up to ${PUBLIC_MAX_SUPPORTING_DOCUMENTS} files · PDF, DOC, or DOCX · 10 MB each`}
              file={null}
              multiple
              files={supportingFiles}
              error={
                fileError && supportingFiles.length > 0 ? fileError : null
              }
              disabled={submitMutation.isPending}
              onFileChange={() => undefined}
              onFilesChange={(next) => {
                setSupportingFiles(next);
                clearRecovery();
              }}
            />

            {fileError && !applyError ? (
              <p className="text-destructive text-sm" role="alert">
                {fileError}
              </p>
            ) : null}

            {applyError?.message ? (
              <p className="text-destructive text-sm" role="alert">
                {applyError.message}
              </p>
            ) : null}
          </div>
        ) : null}

        {currentStep.id === "review" ? (
          <div className="space-y-4">
            <div className="rounded-xl border p-4 text-sm">
              <p className="font-medium">Check your details</p>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Name</dt>
                  <dd>
                    {watchedValues.firstName} {watchedValues.lastName}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{watchedValues.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mobile</dt>
                  <dd>{watchedValues.mobile?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CV</dt>
                  <dd>{cvFile?.name ?? "Missing"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Supporting files</dt>
                  <dd>
                    {supportingFiles.length
                      ? supportingFiles.map((file) => file.name).join(", ")
                      : "None"}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="bg-muted/20 space-y-2 rounded-xl border p-4 text-sm">
              <p className="font-medium">Privacy notice</p>
              <p>{PUBLIC_PRIVACY_NOTICE}</p>
              <a
                href={PUBLIC_PRIVACY_RETENTION_LINK}
                className="text-primary inline-block font-medium hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Read retention and privacy details
              </a>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border"
                checked={Boolean(privacyAcknowledged)}
                aria-required="true"
                onChange={(event) =>
                  form.setValue("privacyAcknowledged", event.target.checked, {
                    shouldValidate: true,
                  })
                }
              />
              <span>
                I acknowledge the privacy notice and consent to processing my
                application for this role.
              </span>
            </label>
            {form.formState.errors.privacyAcknowledged ? (
              <p className="text-destructive text-sm" role="alert">
                {form.formState.errors.privacyAcknowledged.message}
              </p>
            ) : null}

            <TurnstileField onTokenChange={setTurnstileToken} />

            {submitError ? (
              <p className="text-destructive text-sm" role="alert">
                {submitError}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div>
            {stepIndex > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={submitMutation.isPending}
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
              >
                Back
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {currentStep.id === "contact" ? (
              <Button type="button" onClick={() => void goNextFromContact()}>
                Continue to documents
              </Button>
            ) : null}

            {currentStep.id === "documents" ? (
              <Button type="button" onClick={goNextFromDocuments}>
                Continue to review
              </Button>
            ) : null}

            {currentStep.id === "review" ? (
              <Button
                type="submit"
                disabled={submitMutation.isPending || !opening.canApply}
              >
                {submitMutation.isPending
                  ? "Submitting…"
                  : "Submit application"}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  );
}
