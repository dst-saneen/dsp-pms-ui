"use client";

import { useState } from "react";
import {
  Archive,
  GitBranch,
  History,
  Rocket,
  Save,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { OnboardingTemplateVersionHistorySheet } from "../../components/onboarding-template-version-history-sheet";
import { useOnboardingTemplateActions } from "../hooks/use-onboarding-template-actions";
import { useSaveDesigner } from "../hooks/use-save-designer";
import { useOnboardingDesigner } from "../state";

export function OnboardingDesignerToolbar() {
  const { hasPermission } = useAuth();
  const canPublish = hasPermission("hr.onboarding.publish");
  const { state } = useOnboardingDesigner();
  const { save } = useSaveDesigner();

  const template = state.workspace.template;
  const versionId = template.version?.id ?? "";
  const templateId = template.id;

  const {
    validating,
    publishing,
    creatingDraft,
    archiving,
    validate,
    publish,
    createDraft,
    archive,
  } = useOnboardingTemplateActions(versionId, templateId);

  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isDraft = template.version?.status === "DRAFT";
  const isPublished = template.version?.status === "PUBLISHED";

  const handleValidate = async () => {
    try {
      const result = await validate();
      const payload =
        result && typeof result === "object"
          ? (result as {
              valid?: boolean;
              errors?: Array<{ message?: string }>;
              warnings?: Array<{ message?: string }>;
            })
          : null;
      const valid = Boolean(payload?.valid);

      if (valid) {
        toast.success("Template validation passed.");
        return;
      }

      const details = [
        ...(payload?.errors ?? []).map((item) => item.message).filter(Boolean),
        ...(payload?.warnings ?? [])
          .map((item) => item.message)
          .filter(Boolean),
      ].slice(0, 3);

      toast.error(
        details.length > 0
          ? `Validation issues: ${details.join(" · ")}`
          : "Template validation found issues.",
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Validation failed.",
        ),
      );
    }
  };

  const handlePublish = async () => {
    try {
      await publish();
      setPublishConfirmOpen(false);
      toast.success("Template published.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Publish failed.",
        ),
      );
    }
  };

  const handleCreateDraft = async () => {
    try {
      await createDraft();
      toast.success("Draft version created.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not create draft.",
        ),
      );
    }
  };

  const handleArchive = async (targetVersionId: string) => {
    try {
      await archive(targetVersionId);
      toast.success("Version archived.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not archive version.",
        ),
      );
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {state.dirty && (
          <Badge variant="secondary">
            Unsaved Changes
          </Badge>
        )}

        <Button
          variant="outline"
          onClick={() => {
            void save();
          }}
          disabled={!state.dirty}
        >
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>

        <Button
          variant="outline"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="mr-2 h-4 w-4" />
          History
        </Button>

        {isDraft && (
          <>
            <Button
              variant="outline"
              onClick={() => {
                void handleValidate();
              }}
              disabled={validating}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {validating ? "Validating..." : "Validate"}
            </Button>

            {canPublish ? (
              <Button
                onClick={() =>
                  setPublishConfirmOpen(true)
                }
                disabled={publishing}
              >
                <Rocket className="mr-2 h-4 w-4" />
                {publishing ? "Publishing..." : "Publish"}
              </Button>
            ) : null}
          </>
        )}
        {isPublished && (
          <Button
            variant="outline"
            onClick={() => {
              void handleCreateDraft();
            }}
            disabled={creatingDraft}
          >
            <GitBranch className="mr-2 h-4 w-4" />
            {creatingDraft ? "Creating..." : "Create Draft"}
          </Button>
        )}

        {template.version &&
          !template.version.isCurrent &&
          template.version.status !== "ARCHIVED" && (
            <Button
              variant="outline"
              onClick={() => {
                void handleArchive(template.version!.id);
              }}
              disabled={archiving}
            >
              <Archive className="mr-2 h-4 w-4" />
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          )}
      </div>

      <ConfirmActionDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Publish onboarding template"
        message="Publishing makes this version current and archives the previous published version."
        name={template.templateName}
        code={template.templateCode}
        loading={publishing}
        confirmLabel="Publish"
        loadingLabel="Publishing..."
        onConfirm={() => {
          void handlePublish();
        }}
      />

      <OnboardingTemplateVersionHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        templateId={templateId}
        currentVersionId={versionId}
        onArchive={handleArchive}
        archiving={archiving}
      />
    </>
  );
}
