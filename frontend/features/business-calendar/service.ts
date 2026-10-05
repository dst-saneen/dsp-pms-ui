import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  BusinessCalendarRow,
  CalendarEvent,
  CalendarEventCategory,
  CalendarEventSource,
  CalendarEventType,
  CalendarVersion,
  WorkingWeekRule,
} from "./types";

export class BusinessCalendarAdminService {
  static async list(companyId?: string) {
    const response = await apiClient.get<ApiResponse<BusinessCalendarRow[]>>(
      "/business-calendars",
      { params: companyId ? { companyId } : undefined },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async provisionCompany(input: {
    companyId: string;
    calendarCode: string;
    calendarName: string;
    defaultTimezone: string;
  }) {
    const response = await apiClient.post<
      ApiResponse<{ created: boolean; calendar: BusinessCalendarRow }>
    >("/business-calendars/company", input);
    return unwrapApiData(response.data);
  }

  static async provisionBranch(input: {
    branchId: string;
    calendarCode?: string;
    calendarName?: string;
  }) {
    const response = await apiClient.post<
      ApiResponse<{ created: boolean; calendar: BusinessCalendarRow }>
    >("/business-calendars/branch", input);
    return unwrapApiData(response.data);
  }

  static async ensure(input: {
    companyId: string;
    dryRun?: boolean;
    defaultTimezone?: string;
  }) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      "/business-calendars/ensure",
      input,
    );
    return unwrapApiData(response.data);
  }

  static async listVersions(calendarId: string) {
    const response = await apiClient.get<ApiResponse<CalendarVersion[]>>(
      `/business-calendars/${calendarId}/versions`,
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createVersion(
    calendarId: string,
    input: { effectiveFrom: string; effectiveTo?: string; changeReason?: string },
  ) {
    const response = await apiClient.post<ApiResponse<CalendarVersion>>(
      `/business-calendars/${calendarId}/versions`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async getVersion(versionId: string) {
    const response = await apiClient.get<ApiResponse<CalendarVersion>>(
      `/business-calendar-versions/${versionId}`,
    );
    return unwrapApiData(response.data);
  }

  static async replaceWorkingWeek(
    versionId: string,
    input: { rules: WorkingWeekRule[]; optimisticVersion?: number },
  ) {
    const response = await apiClient.put<ApiResponse<CalendarVersion>>(
      `/business-calendar-versions/${versionId}/working-week`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async submitReview(versionId: string, optimisticVersion?: number) {
    const response = await apiClient.post<ApiResponse<CalendarVersion>>(
      `/business-calendar-versions/${versionId}/submit-review`,
      { optimisticVersion },
    );
    return unwrapApiData(response.data);
  }

  static async returnDraft(versionId: string, optimisticVersion?: number) {
    const response = await apiClient.post<ApiResponse<CalendarVersion>>(
      `/business-calendar-versions/${versionId}/return-draft`,
      { optimisticVersion },
    );
    return unwrapApiData(response.data);
  }

  static async publishVersion(
    versionId: string,
    input: {
      optimisticVersion?: number;
      materializeTo?: string;
      impactPreviewAcknowledged?: boolean;
    },
  ) {
    const response = await apiClient.post<
      ApiResponse<
        CalendarVersion & {
          materialize?: {
            written: number;
            skipped: number;
            error?: string;
          };
        }
      >
    >(`/business-calendar-versions/${versionId}/publish`, input);
    return unwrapApiData(response.data);
  }

  static async startAmendment(
    versionId: string,
    input: { effectiveDate: string; reason: string },
  ) {
    const response = await apiClient.post<ApiResponse<CalendarVersion>>(
      `/business-calendar-versions/${versionId}/start-amendment`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async previewImpact(
    versionId: string,
    input?: { from?: string; to?: string },
  ) {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      `/business-calendar-versions/${versionId}/preview-impact`,
      input ?? {},
    );
    return unwrapApiData(response.data);
  }

  static async previewRuntimeDay(input: {
    companyId: string;
    branchId?: string;
    date: string;
    companyVersionId?: string;
    branchVersionId?: string;
  }) {
    const response = await apiClient.post<ApiResponse<Record<string, unknown>>>(
      "/business-calendar/runtime/preview",
      input,
    );
    return unwrapApiData(response.data);
  }

  static async previewRuntimeRange(input: {
    companyId: string;
    branchId?: string;
    from: string;
    to: string;
  }) {
    const response = await apiClient.get<
      ApiResponse<{
        from: string;
        to: string;
        days: Array<{
          businessDate: string;
          dayStatus?: string;
          dayPortion?: string;
          reasonCode?: string;
          reasonText?: string;
          resolutionTrace?: Array<{
            layer: string;
            code: string;
            detail: string;
          }>;
          materialized?: boolean;
        }>;
      }>
    >("/business-calendar/runtime/range", { params: input });
    return unwrapApiData(response.data);
  }

  static async listEvents(versionId: string) {
    const response = await apiClient.get<ApiResponse<CalendarEvent[]>>(
      `/business-calendar-versions/${versionId}/events`,
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async createEvent(
    versionId: string,
    input: Record<string, unknown>,
  ) {
    const response = await apiClient.post<ApiResponse<CalendarEvent>>(
      `/business-calendar-versions/${versionId}/events`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async updateEvent(eventId: string, input: Record<string, unknown>) {
    const response = await apiClient.patch<ApiResponse<CalendarEvent>>(
      `/business-calendar-events/${eventId}`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async deleteEvent(eventId: string) {
    const response = await apiClient.delete<ApiResponse<{ deleted: boolean }>>(
      `/business-calendar-events/${eventId}`,
    );
    return unwrapApiData(response.data);
  }

  static async listEventTypes(companyId?: string) {
    const response = await apiClient.get<ApiResponse<CalendarEventType[]>>(
      "/business-calendar-metadata/event-types",
      { params: companyId ? { companyId } : undefined },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async listCategories(companyId?: string) {
    const response = await apiClient.get<ApiResponse<CalendarEventCategory[]>>(
      "/business-calendar-metadata/categories",
      { params: companyId ? { companyId } : undefined },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async listSources(companyId?: string) {
    const response = await apiClient.get<ApiResponse<CalendarEventSource[]>>(
      "/business-calendar-metadata/sources",
      { params: companyId ? { companyId } : undefined },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async setOfficeRuntimeMode(input: {
    companyId: string;
    branchId?: string;
    mode: "LEGACY" | "SHADOW" | "ACTIVE";
  }) {
    const response = await apiClient.post<ApiResponse<BusinessCalendarRow>>(
      "/business-calendar/runtime/mode",
      input,
    );
    return unwrapApiData(response.data);
  }

  static async listImportBatches(params?: {
    calendarId?: string;
    calendarVersionId?: string;
    companyId?: string;
  }) {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      "/business-calendar-imports",
      { params },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getImportBatch(batchId: string) {
    const response = await apiClient.get<ApiResponse<unknown>>(
      `/business-calendar-imports/${batchId}`,
    );
    return unwrapApiData(response.data);
  }

  static async uploadImport(input: {
    calendarVersionId: string;
    file: File;
    sourceKind?: "CSV" | "EXCEL" | "ICS";
  }) {
    const form = new FormData();
    form.append("calendarVersionId", input.calendarVersionId);
    if (input.sourceKind) form.append("sourceKind", input.sourceKind);
    form.append("file", input.file);
    const response = await apiClient.post<ApiResponse<unknown>>(
      "/business-calendar-imports",
      form,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return unwrapApiData(response.data);
  }

  static async downloadImportTemplate(kind: "csv" | "xlsx") {
    const response = await apiClient.get<Blob>(
      `/business-calendar-imports/template.${kind}`,
      { responseType: "blob" },
    );
    const payload = response.data;
    if (!(payload instanceof Blob) || payload.size === 0) {
      throw new Error("Template download returned an empty file.");
    }
    // API errors can arrive as JSON inside a blob when responseType is blob.
    if (payload.type.includes("application/json") || payload.type.includes("text/plain")) {
      const text = await payload.text();
      throw new Error(text.slice(0, 200) || "Template download failed.");
    }
    const mime =
      kind === "csv"
        ? "text/csv;charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob =
      payload.type && payload.type !== "application/octet-stream"
        ? payload
        : new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `business-calendar-import-template.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static async importGovernmentPack(input: {
    calendarVersionId: string;
    countryCode: string;
    subdivisionCode?: string;
    year: number;
  }) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      "/business-calendar-imports/government",
      input,
    );
    return unwrapApiData(response.data);
  }

  static async validateImport(batchId: string) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/business-calendar-imports/${batchId}/validate`,
    );
    return unwrapApiData(response.data);
  }

  static async reviewImport(
    batchId: string,
    input: { selectedRowIds: string[]; approve?: boolean },
  ) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/business-calendar-imports/${batchId}/review`,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async applyImportToDraft(batchId: string) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/business-calendar-imports/${batchId}/apply-to-draft`,
    );
    return unwrapApiData(response.data);
  }

  static async rejectImport(batchId: string) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/business-calendar-imports/${batchId}/reject`,
    );
    return unwrapApiData(response.data);
  }

  static async listJurisdictions() {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      "/business-calendar-imports/jurisdictions",
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async listImpacts(params?: {
    companyId?: string;
    branchId?: string;
    status?: string;
  }) {
    const response = await apiClient.get<ApiResponse<unknown[]>>(
      "/business-calendar/impacts",
      { params },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async resolveImpact(
    impactId: string,
    input?: { resolutionReason?: string },
  ) {
    const response = await apiClient.post<ApiResponse<unknown>>(
      `/business-calendar/impacts/${impactId}/resolve`,
      input ?? {},
    );
    return unwrapApiData(response.data);
  }

  static async getCalendar(calendarId: string) {
    const rows = await this.list();
    return rows.find((row) => row.id === calendarId) ?? null;
  }
}
