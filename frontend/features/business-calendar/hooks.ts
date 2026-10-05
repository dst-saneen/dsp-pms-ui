"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/services/api-client";

import { BusinessCalendarAdminService } from "./service";
import type {
  ImportBatchDetail,
  ImportBatchSummary,
  ImportJurisdiction,
  WorkingWeekRule,
} from "./types";

export const businessCalendarKeys = {
  all: ["business-calendars"] as const,
  list: (companyId?: string) =>
    [...businessCalendarKeys.all, "list", companyId ?? "all"] as const,
  versions: (calendarId: string) =>
    [...businessCalendarKeys.all, "versions", calendarId] as const,
  version: (versionId: string) =>
    [...businessCalendarKeys.all, "version", versionId] as const,
  events: (versionId: string) =>
    [...businessCalendarKeys.all, "events", versionId] as const,
  metadata: (companyId?: string) =>
    [...businessCalendarKeys.all, "metadata", companyId ?? "all"] as const,
  imports: (filters: string) =>
    [...businessCalendarKeys.all, "imports", filters] as const,
  importBatch: (batchId: string) =>
    [...businessCalendarKeys.all, "import-batch", batchId] as const,
  jurisdictions: () => [...businessCalendarKeys.all, "jurisdictions"] as const,
  impacts: (filters: string) =>
    [...businessCalendarKeys.all, "impacts", filters] as const,
};

export function useBusinessCalendars(companyId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.list(companyId),
    queryFn: () => BusinessCalendarAdminService.list(companyId),
  });
}

export function useProvisionCompanyCalendar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.provisionCompany,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success(
        result?.created
          ? "Company calendar created."
          : "Company calendar already exists.",
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not create company calendar.")),
  });
}

export function useProvisionBranchCalendar() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.provisionBranch,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success(
        result?.created
          ? "Branch calendar created."
          : "Branch calendar already exists.",
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not create branch calendar.")),
  });
}

export function useEnsureOfficeCalendars() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.ensure,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      const plan = (
        result as { dryRun?: boolean; plan?: Array<{ action: string }> }
      )?.plan;
      const creates =
        plan?.filter((row) => row.action.startsWith("CREATE")).length ?? 0;
      const dryRun = (result as { dryRun?: boolean })?.dryRun;
      toast.success(
        dryRun
          ? `Check complete: ${creates} calendar(s) would be created.`
          : `Setup complete: ${creates} missing calendar(s) created where needed.`,
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not update office calendars.")),
  });
}

export function useSetOfficeRuntimeMode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.setOfficeRuntimeMode,
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success(
        result.runtimeMode === "ACTIVE"
          ? "Published calendar is now in use."
          : "Calendar is now in testing mode.",
      );
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not change calendar mode.")),
  });
}

export function useCalendarVersions(calendarId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.versions(calendarId ?? ""),
    queryFn: () => BusinessCalendarAdminService.listVersions(calendarId!),
    enabled: !!calendarId,
  });
}

export function useCalendarVersion(versionId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.version(versionId ?? ""),
    queryFn: () => BusinessCalendarAdminService.getVersion(versionId!),
    enabled: !!versionId,
  });
}

export function useVersionEvents(versionId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.events(versionId ?? ""),
    queryFn: () => BusinessCalendarAdminService.listEvents(versionId!),
    enabled: !!versionId,
  });
}

export function useCalendarMetadata(companyId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.metadata(companyId),
    queryFn: async () => {
      const [eventTypes, categories, sources] = await Promise.all([
        BusinessCalendarAdminService.listEventTypes(companyId),
        BusinessCalendarAdminService.listCategories(companyId),
        BusinessCalendarAdminService.listSources(companyId),
      ]);
      return { eventTypes, categories, sources };
    },
  });
}

function invalidateVersion(client: ReturnType<typeof useQueryClient>, versionId: string) {
  void client.invalidateQueries({ queryKey: businessCalendarKeys.version(versionId) });
  void client.invalidateQueries({ queryKey: businessCalendarKeys.events(versionId) });
  void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
}

export function useCreateCalendarVersion(calendarId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      effectiveFrom: string;
      effectiveTo?: string;
      changeReason?: string;
    }) => BusinessCalendarAdminService.createVersion(calendarId, input),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: businessCalendarKeys.versions(calendarId),
      });
      toast.success("Draft created.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not create draft.")),
  });
}

export function useReplaceWorkingWeek(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      rules: WorkingWeekRule[];
      optimisticVersion?: number;
    }) => BusinessCalendarAdminService.replaceWorkingWeek(versionId, input),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Working week saved.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not save working week.")),
  });
}

export function useSubmitVersionReview(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (optimisticVersion?: number) =>
      BusinessCalendarAdminService.submitReview(versionId, optimisticVersion),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Sent for review.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not send for review.")),
  });
}

export function useReturnVersionDraft(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (optimisticVersion?: number) =>
      BusinessCalendarAdminService.returnDraft(versionId, optimisticVersion),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Returned to draft.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not return to draft.")),
  });
}

export function usePublishVersion(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      optimisticVersion?: number;
      materializeTo?: string;
      impactPreviewAcknowledged?: boolean;
    }) => BusinessCalendarAdminService.publishVersion(versionId, input),
    onSuccess: (result) => {
      invalidateVersion(client, versionId);
      if (result.materialize?.error) {
        toast.warning(
          "Published, but calendar days failed to materialize. Rebuild runtime if holidays are missing.",
        );
        return;
      }
      toast.success("Published. Earlier history is kept.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not publish.")),
  });
}

export function useStartAmendment(publishedVersionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { effectiveDate: string; reason: string }) =>
      BusinessCalendarAdminService.startAmendment(publishedVersionId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Change draft created.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not start edit.")),
  });
}

export function usePreviewImpact(versionId: string) {
  return useMutation({
    mutationFn: (input?: { from?: string; to?: string }) =>
      BusinessCalendarAdminService.previewImpact(versionId, input),
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not preview changes.")),
  });
}

export function usePreviewRuntimeDay() {
  return useMutation({
    mutationFn: BusinessCalendarAdminService.previewRuntimeDay,
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Day preview failed.")),
  });
}

export function usePreviewRuntimeRange() {
  return useMutation({
    mutationFn: BusinessCalendarAdminService.previewRuntimeRange,
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not load calendar preview.")),
  });
}

export function useCreateCalendarEvent(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      BusinessCalendarAdminService.createEvent(versionId, input),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Holiday / event added.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not add holiday / event.")),
  });
}

export function useUpdateCalendarEvent(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { eventId: string; data: Record<string, unknown> }) =>
      BusinessCalendarAdminService.updateEvent(input.eventId, input.data),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Holiday / event updated.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not update holiday / event.")),
  });
}

export function useDeleteCalendarEvent(versionId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) =>
      BusinessCalendarAdminService.deleteEvent(eventId),
    onSuccess: () => {
      invalidateVersion(client, versionId);
      toast.success("Removed from draft.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not remove item.")),
  });
}

export function useImportBatches(filters?: {
  companyId?: string;
  calendarId?: string;
  calendarVersionId?: string;
}) {
  const key = JSON.stringify(filters ?? {});
  return useQuery({
    queryKey: businessCalendarKeys.imports(key),
    queryFn: () =>
      BusinessCalendarAdminService.listImportBatches(filters) as Promise<
        ImportBatchSummary[]
      >,
  });
}

export function useImportBatch(batchId?: string) {
  return useQuery({
    queryKey: businessCalendarKeys.importBatch(batchId ?? ""),
    queryFn: () =>
      BusinessCalendarAdminService.getImportBatch(batchId!) as Promise<
        ImportBatchDetail
      >,
    enabled: !!batchId,
  });
}

export function useImportJurisdictions() {
  return useQuery({
    queryKey: businessCalendarKeys.jurisdictions(),
    queryFn: () =>
      BusinessCalendarAdminService.listJurisdictions() as Promise<
        ImportJurisdiction[]
      >,
    staleTime: 60 * 60 * 1000,
  });
}

export function useUploadImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.uploadImport,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("File uploaded — review the batch next.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not upload file.")),
  });
}

export function useDownloadImportTemplate() {
  return useMutation({
    mutationFn: (kind: "csv" | "xlsx") =>
      BusinessCalendarAdminService.downloadImportTemplate(kind),
    onSuccess: (_data, kind) =>
      toast.success(
        kind === "xlsx"
          ? "Excel template downloaded."
          : "CSV template downloaded.",
      ),
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not download template.")),
  });
}

export function useImportGovernmentPack() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: BusinessCalendarAdminService.importGovernmentPack,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Holiday pack loaded — review before adding to draft.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not load holiday pack.")),
  });
}

export function useValidateImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) =>
      BusinessCalendarAdminService.validateImport(batchId),
    onSuccess: (_data, batchId) => {
      void client.invalidateQueries({
        queryKey: businessCalendarKeys.importBatch(batchId),
      });
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Rows checked — approve the ones you want.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not validate import.")),
  });
}

export function useReviewImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      batchId: string;
      selectedRowIds: string[];
      approve?: boolean;
    }) =>
      BusinessCalendarAdminService.reviewImport(input.batchId, {
        selectedRowIds: input.selectedRowIds,
        approve: input.approve,
      }),
    onSuccess: (_data, input) => {
      void client.invalidateQueries({
        queryKey: businessCalendarKeys.importBatch(input.batchId),
      });
      toast.success("Selected holidays approved.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not approve rows.")),
  });
}

export function useApplyImportToDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) =>
      BusinessCalendarAdminService.applyImportToDraft(batchId),
    onSuccess: (_data, batchId) => {
      void client.invalidateQueries({
        queryKey: businessCalendarKeys.importBatch(batchId),
      });
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Added to draft calendar — not published yet.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not add to draft.")),
  });
}

export function useRejectImport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (batchId: string) =>
      BusinessCalendarAdminService.rejectImport(batchId),
    onSuccess: (_data, batchId) => {
      void client.invalidateQueries({
        queryKey: businessCalendarKeys.importBatch(batchId),
      });
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Import discarded.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not reject import.")),
  });
}

export function useBusinessCalendarImpacts(filters?: {
  companyId?: string;
  branchId?: string;
  status?: string;
}) {
  const key = JSON.stringify(filters ?? {});
  return useQuery({
    queryKey: businessCalendarKeys.impacts(key),
    queryFn: () => BusinessCalendarAdminService.listImpacts(filters),
  });
}

export function useResolveCalendarImpact() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { impactId: string; resolutionReason?: string }) =>
      BusinessCalendarAdminService.resolveImpact(input.impactId, {
        resolutionReason: input.resolutionReason,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: businessCalendarKeys.all });
      toast.success("Marked as reviewed.");
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Could not mark as reviewed.")),
  });
}
