import { apiClient, unwrapApiData } from "@/services/api-client";
import { API_ENDPOINTS } from "@/config/api";
import type { ApiResponse } from "@/types/api";
import { OptionalHolidayService } from "@/features/optional-holiday/service";

import type {
  CreateMyLeaveRequestInput,
  LeaveTypeOption,
  MyAttendanceException,
  MyAttendanceRecord,
  MyCalendarDay,
  MyCompOffCredit,
  MyOvertimeRequest,
  MyWorkspace,
} from "../types";

export const MeService = {
  async getWorkspace(): Promise<MyWorkspace> {
    const response = await apiClient.get<ApiResponse<MyWorkspace>>(API_ENDPOINTS.me.workspace);
    return unwrapApiData(response.data);
  },

  async getAttendance(): Promise<{
    today: MyAttendanceRecord | null;
    timezone: string | null;
  }> {
    const response = await apiClient.get<
      ApiResponse<{
        today: MyAttendanceRecord | null;
        timezone: string | null;
      }>
    >(API_ENDPOINTS.me.attendance);
    return unwrapApiData(response.data);
  },

  async checkIn(): Promise<MyAttendanceRecord> {
    const response = await apiClient.post<ApiResponse<MyAttendanceRecord>>(
      API_ENDPOINTS.me.attendanceCheckIn
    );
    return unwrapApiData(response.data);
  },

  async checkOut(): Promise<MyAttendanceRecord> {
    const response = await apiClient.post<ApiResponse<MyAttendanceRecord>>(
      API_ENDPOINTS.me.attendanceCheckOut
    );
    return unwrapApiData(response.data);
  },

  async getLeave(year?: number) {
    const response = await apiClient.get<
      ApiResponse<{
        summary: import("../types").MyLeaveSummary;
        balances: import("../types").MyLeaveBalance[];
        history: import("../types").MyLeaveHistory[];
        upcoming: import("../types").MyUpcomingLeave[];
      }>
    >(API_ENDPOINTS.me.leave, {
      params: year ? { year } : undefined,
    });
    return unwrapApiData(response.data);
  },

  async createLeaveRequest(input: CreateMyLeaveRequestInput) {
    const response = await apiClient.post(API_ENDPOINTS.me.leaveRequests, input);
    return unwrapApiData(response.data);
  },

  async previewLeaveRequest(input: CreateMyLeaveRequestInput) {
    const response = await apiClient.post(API_ENDPOINTS.me.leavePreviews, input);
    return unwrapApiData(response.data) as import("../types").MyLeavePreview;
  },

  async submitLeaveRequest(id: string) {
    const response = await apiClient.post(`${API_ENDPOINTS.me.leaveRequests}/${id}/submit`);
    return unwrapApiData(response.data);
  },

  async cancelLeaveRequest(id: string, reason?: string) {
    const response = await apiClient.post(`${API_ENDPOINTS.me.leaveRequests}/${id}/cancel`, {
      reason,
    });
    return unwrapApiData(response.data);
  },

  async listLeaveTypes(): Promise<LeaveTypeOption[]> {
    const response = await apiClient.get<ApiResponse<LeaveTypeOption[]>>(
      API_ENDPOINTS.me.leaveTypes
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async getOvertime(): Promise<MyOvertimeRequest[]> {
    const response = await apiClient.get<ApiResponse<MyOvertimeRequest[]>>(
      API_ENDPOINTS.me.overtime
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async getCompOff(): Promise<MyCompOffCredit[]> {
    const response = await apiClient.get<ApiResponse<MyCompOffCredit[]>>(API_ENDPOINTS.me.compOff);
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async getAttendanceExceptions(): Promise<MyAttendanceException[]> {
    const response = await apiClient.get<ApiResponse<MyAttendanceException[]>>(
      API_ENDPOINTS.me.attendanceExceptions
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  },

  async getWorkforceCalendar(fromDate: string, toDate: string) {
    const response = await apiClient.get<
      ApiResponse<{
        fromDate: string;
        toDate: string;
        accessMode: string;
        days: MyCalendarDay[];
      }>
    >(API_ENDPOINTS.me.workforceCalendar, {
      params: { fromDate, toDate },
    });
    return unwrapApiData(response.data);
  },

  async submitOvertime(
    id: string,
    input: {
      requestedSettlement: string;
      requestedMinutes: number;
      reason?: string;
    }
  ) {
    const response = await apiClient.post(`${API_ENDPOINTS.me.overtime}/${id}/submit`, input);
    return unwrapApiData(response.data);
  },

  async submitRegularization(input: {
    attendanceId: string;
    attendanceExceptionId?: string;
    proposedCheckInAt?: string;
    proposedCheckOutAt?: string;
    reason: string;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.me.attendanceRegularizations, input);
    return unwrapApiData(response.data);
  },

  async getAssets() {
    const response = await apiClient.get<ApiResponse<import("../types").MyAssetsResponse>>(
      API_ENDPOINTS.me.assets
    );
    return unwrapApiData(response.data);
  },

  async acknowledgeAssignment(id: string, expectedVersion?: number) {
    const response = await apiClient.post(
      `${API_ENDPOINTS.me.assets}/assignments/${id}/acknowledge`,
      { operationId: createRequestOperationId(), expectedVersion }
    );
    return unwrapApiData(response.data);
  },

  async acknowledgeAllocation(id: string, expectedVersion?: number) {
    const response = await apiClient.post(
      `${API_ENDPOINTS.me.assets}/allocations/${id}/acknowledge`,
      { operationId: createRequestOperationId(), expectedVersion }
    );
    return unwrapApiData(response.data);
  },

  async createAssetRequest(input: {
    targetType: "EMPLOYEE_ASSET" | "LICENSE_ALLOCATION";
    targetId: string;
    requestType: "RETURN" | "REPORT_DAMAGED" | "REPORT_LOST" | "REVOKE_LICENSE";
    expectedTargetVersion: number;
    occurredOn?: string;
    employeeNote?: string;
  }) {
    const response = await apiClient.post(API_ENDPOINTS.me.assetRequests, {
      operationId: createRequestOperationId(),
      ...input,
    });
    return unwrapApiData(response.data);
  },

  async getOptionalHolidays(year: number) {
    return OptionalHolidayService.getOptionalHolidays(year);
  },

  async updateOptionalHolidaySelections(year: number, eventIds: string[]) {
    return OptionalHolidayService.updateOptionalHolidaySelections(year, eventIds);
  },
};

function createRequestOperationId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}
