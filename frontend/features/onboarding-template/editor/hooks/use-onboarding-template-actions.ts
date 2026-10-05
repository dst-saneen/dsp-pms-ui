"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { onboardingTemplateKeys } from "@/features/onboarding-template/hooks";
import { OnboardingTemplateVersionService } from "@/features/onboarding-template/services";
import { useSaveDesigner } from "./use-save-designer";
import { useOnboardingDesigner } from "../state";
import { OnboardingWorkspaceService } from "../../services/onboarding-workspace-service";
import { getApiErrorMessage } from "@/services/api-client";

export function useOnboardingTemplateActions(versionId: string, templateId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, dispatch } = useOnboardingDesigner();
  const { save } = useSaveDesigner();

  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: onboardingTemplateKeys.detail(templateId),
      }),
      queryClient.invalidateQueries({
        queryKey: onboardingTemplateKeys.workspace(templateId),
      }),
      queryClient.invalidateQueries({
        queryKey: ["onboarding-workspace", templateId],
      }),
      queryClient.invalidateQueries({
        queryKey: onboardingTemplateKeys.versionHistory(templateId),
      }),
    ]);

    const workspace = await OnboardingWorkspaceService.getEditor(templateId);
    dispatch({
      type: "SET_WORKSPACE",
      payload: workspace,
    });
    return workspace;
  }

  async function saveThenReload() {
    await save();
    return refresh();
  }

  async function validate() {
    setValidating(true);
    try {
      await saveThenReload();
      return await OnboardingTemplateVersionService.validate(versionId);
    } finally {
      setValidating(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      const workspace = await saveThenReload();
      await OnboardingTemplateVersionService.validate(versionId);
      const expectedVersion = workspace.template.version?.rowVersion;
      if (!expectedVersion) {
        throw new Error("Refresh the template before publishing this version.");
      }
      await OnboardingTemplateVersionService.publish(versionId, expectedVersion);
      await refresh();
    } catch (error) {
      const message = getApiErrorMessage(error, "Publish failed.");
      if (message.toLowerCase().includes("changed")) {
        toast.error("The version changed. Your edits were kept; review the latest data.");
        await refresh();
      }
      throw error;
    } finally {
      setPublishing(false);
    }
  }

  async function createDraft() {
    setCreatingDraft(true);
    try {
      const draft = await OnboardingTemplateVersionService.createDraft(versionId);
      await refresh();
      router.push(`/hr/onboarding-templates/${draft.onboardingTemplateId}`);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function archive(targetVersionId: string = versionId) {
    setArchiving(true);
    try {
      await OnboardingTemplateVersionService.archive(targetVersionId);
      await refresh();
    } finally {
      setArchiving(false);
    }
  }

  return {
    validating,
    publishing,
    creatingDraft,
    archiving,
    save,
    validate,
    publish,
    createDraft,
    archive,
    refresh,
    versionRowVersion: state.workspace.template.version?.rowVersion,
  };
}
