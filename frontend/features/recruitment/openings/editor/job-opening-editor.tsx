"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/providers/auth-provider";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";

import { OpeningStatusBadge } from "../../components/opening-status-badge";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { OpeningApplyLink } from "../components/opening-apply-link";
import { PublicationChecklistPanel } from "../components/publication-checklist-panel";
import { JobOpeningForm } from "../forms/job-opening-form";
import {
  useCloseJobOpening,
  useCreateJobOpening,
  useHoldJobOpening,
  useJobOpening,
  usePublicationChecklist,
  usePublishJobOpening,
  useReopenJobOpening,
  useUpdateJobOpening,
} from "../hooks/use-job-openings";
import type { CreateJobOpeningDto } from "../types/create-job-opening";
import {
  focusOpeningFormTarget,
  resolvePublicationChecklistFocus,
  type OpeningFormFocusTarget,
} from "../utils/publication-checklist-focus";

interface JobOpeningEditorProps {
  openingId?: string;
}

export function JobOpeningEditor({ openingId }: JobOpeningEditorProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const isNew = !openingId;

  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);

  const openingQuery = useJobOpening(openingId);
  const checklistQuery = usePublicationChecklist(openingId);

  const createMutation = useCreateJobOpening();
  const updateMutation = useUpdateJobOpening();
  const publishMutation = usePublishJobOpening();
  const holdMutation = useHoldJobOpening();
  const reopenMutation = useReopenJobOpening();
  const closeMutation = useCloseJobOpening();

  const [confirmAction, setConfirmAction] = useState<
    "hold" | "reopen" | "close" | null
  >(null);
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [highlightTarget, setHighlightTarget] =
    useState<OpeningFormFocusTarget | null>(null);

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  const opening = openingQuery.data;
  const readOnly = Boolean(opening && !opening.allowedActions.canEdit);
  const canEdit = canManage && (isNew || Boolean(opening?.allowedActions.canEdit));
  const checklist = checklistQuery.data;
  const canPublish =
    Boolean(opening?.allowedActions.canPublish) &&
    (checklist ? checklist.canPublish : Boolean(opening?.allowedActions.canPublish));

  useSetEntityBreadcrumbs([
    {
      label: isNew
        ? "New job opening"
        : opening
          ? opening.title
          : "Job opening",
      href: null,
    },
  ]);

  useEffect(() => {
    if (!highlightTarget) return;

    const timer = window.setTimeout(() => {
      focusOpeningFormTarget(highlightTarget);
    }, 50);

    const clearTimer = window.setTimeout(() => {
      setHighlightTarget(null);
    }, 4_000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightTarget]);

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    publishMutation.isPending ||
    holdMutation.isPending ||
    reopenMutation.isPending ||
    closeMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(RECRUITMENT_ROUTES.openings.list);
  }, [confirmLeave, router]);

  const handleFocusChecklistItem = useCallback((code: string) => {
    setHighlightTarget(resolvePublicationChecklistFocus(code));
  }, []);

  const handleSubmit = async (payload: CreateJobOpeningDto) => {
    setValidationErrors([]);

    if (isNew) {
      const created = await createMutation.mutateAsync(payload);
      router.replace(RECRUITMENT_ROUTES.openings.detail(created.id));
      return;
    }

    if (!opening) return;

    await updateMutation.mutateAsync({
      id: opening.id,
      data: {
        ...payload,
        version: opening.version,
      },
    });
    await checklistQuery.refetch();
  };

  const handlePublish = async () => {
    if (!opening) return;

    if (isDirty) {
      toast.error("Save your changes before publishing.");
      return;
    }

    if (checklist && !checklist.canPublish) {
      const firstFailed = checklist.items.find((item) => !item.passed);
      if (firstFailed) {
        handleFocusChecklistItem(firstFailed.code);
      }
      toast.error("Resolve the publication checklist before publishing.");
      return;
    }

    try {
      await publishMutation.mutateAsync({
        id: opening.id,
        version: opening.version,
      });
      await checklistQuery.refetch();
    } catch {
      // Form values stay on screen; mutation hook already toasts.
    }
  };

  const handleConfirmedAction = async () => {
    if (!opening || !confirmAction) return;

    if (isDirty && !confirmLeave()) return;

    const input = { id: opening.id, version: opening.version };

    if (confirmAction === "hold") {
      await holdMutation.mutateAsync(input);
    } else if (confirmAction === "reopen") {
      await reopenMutation.mutateAsync(input);
    } else if (confirmAction === "close") {
      await closeMutation.mutateAsync(input);
    }

    setConfirmAction(null);
    await checklistQuery.refetch();
  };

  if (!isNew && openingQuery.isLoading) {
    return (
      <EntityFormPage
        title="Job opening"
        description="Loading job opening…"
        formId="job-opening-form"
        onSecondary={goBack}
        showPrimary={false}
      >
        <div className="text-muted-foreground text-sm">Loading…</div>
      </EntityFormPage>
    );
  }

  if (!isNew && !opening) {
    return (
      <EntityFormPage
        title="Job opening"
        description="This opening could not be found."
        formId="job-opening-form"
        onSecondary={goBack}
        showPrimary={false}
      >
        <div className="text-sm">Job opening not found.</div>
      </EntityFormPage>
    );
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {!isNew && opening ? <OpeningStatusBadge status={opening.status} /> : null}

      {canManage && opening?.allowedActions.canPublish ? (
        <Button
          type="button"
          onClick={() => void handlePublish()}
          disabled={isSaving || !canPublish || isDirty}
        >
          Publish
        </Button>
      ) : null}

      {canManage && opening?.allowedActions.canHold ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmAction("hold")}
          disabled={isSaving}
        >
          Hold
        </Button>
      ) : null}

      {canManage && opening?.allowedActions.canReopen ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmAction("reopen")}
          disabled={isSaving}
        >
          Reopen
        </Button>
      ) : null}

      {canManage && opening?.allowedActions.canClose ? (
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmAction("close")}
          disabled={isSaving}
        >
          Close
        </Button>
      ) : null}
    </div>
  );

  return (
    <>
      <EntityFormPage
        title={isNew ? "Create job opening" : (opening?.title ?? "Job opening")}
        description={
          isNew
            ? "Draft an opening with role, organization, hiring, dates, and criteria."
            : `${opening?.openingCode ?? ""}${opening ? ` · v${opening.version}` : ""}`
        }
        headerActions={headerActions}
        formId="job-opening-form"
        primaryLabel={isNew ? "Create draft" : "Save changes"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showPrimary={canEdit}
      >
        <div className="space-y-6">
          <FormValidationSummary errors={validationErrors} />

          {!isNew && opening ? <OpeningApplyLink opening={opening} /> : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <JobOpeningForm
              opening={opening}
              readOnly={readOnly || !canManage}
              onSubmit={(payload) => void handleSubmit(payload)}
              onDirtyChange={setIsDirty}
              onInvalid={setValidationErrors}
              highlightTarget={highlightTarget}
            />

            <aside className="xl:sticky xl:top-4 xl:self-start">
              <PublicationChecklistPanel
                checklist={isNew ? undefined : checklist}
                isLoading={!isNew && checklistQuery.isLoading}
                onFocusItem={handleFocusChecklistItem}
              />
            </aside>
          </div>
        </div>
      </EntityFormPage>

      <ConfirmActionDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction === "hold"
            ? "Place opening on hold"
            : confirmAction === "reopen"
              ? "Reopen opening"
              : "Close opening"
        }
        message={
          confirmAction === "hold"
            ? "Candidates will not be able to apply while this opening is on hold."
            : confirmAction === "reopen"
              ? "The opening will accept applications again after reopening."
              : "This is a terminal administrative action for the opening."
        }
        name={opening?.title ?? ""}
        code={opening?.openingCode}
        confirmLabel={
          confirmAction === "hold"
            ? "Hold opening"
            : confirmAction === "reopen"
              ? "Reopen opening"
              : "Close opening"
        }
        loading={isSaving}
        onConfirm={() => void handleConfirmedAction()}
      />
    </>
  );
}
