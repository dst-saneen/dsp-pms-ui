import { API_ENDPOINTS } from "@/config/api";
import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import type {
  CreateShiftRosterInput,
  GenerateShiftRosterInput,
  OverrideRosterEntryInput,
  RosterVersionInput,
  ShiftRoster,
  ShiftRosterFilters,
  ShiftRosterGenerateResult,
} from "../types";

export class ShiftRosterService {
  static async getAll(filters?: ShiftRosterFilters) {
    const response = await apiClient.get<ApiResponse<ShiftRoster[]>>(
      API_ENDPOINTS.shiftRosters.list,
      { params: filters },
    );
    const data = unwrapApiData(response.data);
    return Array.isArray(data) ? data : [];
  }

  static async getById(id: string) {
    const response = await apiClient.get<ApiResponse<ShiftRoster>>(
      `${API_ENDPOINTS.shiftRosters.list}/${id}`,
    );
    return unwrapApiData(response.data);
  }

  static async create(input: CreateShiftRosterInput) {
    const response = await apiClient.post<ApiResponse<ShiftRoster>>(
      API_ENDPOINTS.shiftRosters.list,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async generate(input: GenerateShiftRosterInput) {
    const response = await apiClient.post<ApiResponse<ShiftRosterGenerateResult>>(
      API_ENDPOINTS.shiftRosters.generate,
      input,
    );
    return unwrapApiData(response.data);
  }

  static async publish(id: string, input: RosterVersionInput) {
    return this.versionedAction(id, "publish", input);
  }

  static async lock(id: string, input: RosterVersionInput) {
    return this.versionedAction(id, "lock", input);
  }

  static async archive(id: string, input: RosterVersionInput) {
    return this.versionedAction(id, "archive", input);
  }

  static async overrideEntry(id: string, input: OverrideRosterEntryInput) {
    const response = await apiClient.post<ApiResponse<ShiftRoster>>(
      `${API_ENDPOINTS.shiftRosters.list}/${id}/overrides`,
      input,
    );
    return unwrapApiData(response.data);
  }

  private static async versionedAction(
    id: string,
    action: "publish" | "lock" | "archive",
    input: RosterVersionInput,
  ) {
    const response = await apiClient.post<ApiResponse<ShiftRoster>>(
      `${API_ENDPOINTS.shiftRosters.list}/${id}/${action}`,
      input,
    );
    return unwrapApiData(response.data);
  }
}
