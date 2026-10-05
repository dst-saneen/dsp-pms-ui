"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  GitBranch,
  History,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { OnboardingTemplateVersionHistorySheet } from "../components/onboarding-template-version-history-sheet";
import type { OnboardingTemplate } from "../types";

interface Props {
  template: OnboardingTemplate;

  saving?: boolean;

  validating?: boolean;

  publishing?: boolean;

  creatingDraft?: boolean;

  archiving?: boolean;

  lastSavedAt?: Date;

  saveError?: string;

  onSave: () => Promise<void>;

  onValidate: () => Promise<unknown>;

  onPublish: () => Promise<void>;

  onCreateDraft?: () => Promise<void>;

  onArchive?: (versionId: string) => Promise<void>;
}

export function OnboardingTemplateProfileHeader({
  template,
  saving = false,
  validating = false,
  publishing = false,
  creatingDraft = false,
  archiving = false,
  lastSavedAt,
  saveError,
  onSave,
  onValidate,
  onPublish,
  onCreateDraft,
  onArchive,
}: Props) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canPublish = hasPermission("hr.onboarding.publish");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const version = template.version;

  const isDraft = version?.status === "DRAFT";
  const isPublished = version?.status === "PUBLISHED";

  const handleValidate = async () => {
    try {
      const result = await onValidate();
      const payload =
        result && typeof result === "object"
          ? (result as {
              valid?: boolean;
              errors?: Array<{ message?: string; code?: string }>;
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
      await onPublish();
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
    if (!onCreateDraft) {
      return;
    }

    try {
      await onCreateDraft();
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

  const handleArchive = async (versionId: string) => {
    if (!onArchive) {
      return;
    }

    try {
      await onArchive(versionId);
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
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() =>
          router.push("/hr/onboarding-templates")
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Templates
      </Button>

      <Card>
        <CardContent className="p-8">
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-bold">
                  {template.templateName}
                </h1>

                <p className="text-muted-foreground">
                  {template.templateCode}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  Version {version?.versionNo}
                </Badge>

                <Badge
                  variant={
                    isPublished
                      ? "default"
                      : "outline"
                  }
                >
                  {version?.status}
                </Badge>
              </div>

              {lastSavedAt && (
                <p className="text-sm text-muted-foreground">
                  Last saved at{" "}
                  {lastSavedAt.toLocaleTimeString()}
                </p>
              )}

              {saveError && (
                <p className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
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
                      void onSave();
                    }}
                    disabled={saving}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save"}
                  </Button>

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
                      <Upload className="mr-2 h-4 w-4" />
                      {publishing ? "Publishing..." : "Publish"}
                    </Button>
                  ) : null}
                </>
              )}

              {isPublished && onCreateDraft && (
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

              {onArchive &&
                version &&
                !version.isCurrent &&
                version.status !== "ARCHIVED" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      void handleArchive(version.id);
                    }}
                    disabled={archiving}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {archiving ? "Archiving..." : "Archive"}
                  </Button>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        title="Publish onboarding template"
        message="Publishing makes this version current and archives the previous published version. Ensure validation passes before continuing."
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
        templateId={template.id}
        currentVersionId={version?.id}
        onArchive={onArchive}
        archiving={archiving}
      />
    </>
  );
}
