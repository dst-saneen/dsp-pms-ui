import { apiClient, unwrapApiData } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";

import { createOperationId } from "../lib/allowed-actions";
import type {
  Paginated,
  Timesheet,
  VersionedCommand,
} from "../types/project.types";

export class TimesheetsApiService {
  static async listMine(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Timesheet>> {
    const response = await apiClient.get<ApiResponse<Paginated<Timesheet>>>(
      "/me/timesheets",
      { params },
    );
    return unwrapApiData(response.data);
  }

  static async getMine(id: string): Promise<Timesheet> {
    const response = await apiClient.get<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}`,
    );
    return unwrapApiData(response.data);
  }

  static async create(body: {
    periodStart: string;
    remarks?: string;
    operationId?: string;
  }): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      "/me/timesheets",
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async addLine(
    id: string,
    body: {
      workDate: string;
      hours: string;
      taskId?: string;
      workCategoryId?: string;
      remarks?: string;
      expectedVersion: number;
      operationId?: string;
    },
  ): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}/lines`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async updateLine(
    id: string,
    lineId: string,
    body: {
      workDate?: string;
      hours?: string;
      taskId?: string | null;
      workCategoryId?: string | null;
      remarks?: string | null;
      expectedVersion: number;
      lineExpectedVersion: number;
      operationId?: string;
    },
  ): Promise<Timesheet> {
    const response = await apiClient.patch<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}/lines/${lineId}`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async removeLine(
    id: string,
    lineId: string,
    body: VersionedCommand,
  ): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}/lines/${lineId}/remove`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async submit(id: string, body: VersionedCommand): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}/submit`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async cancel(id: string, body: VersionedCommand): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/me/timesheets/${id}/cancel`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async listTeam(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Timesheet>> {
    const response = await apiClient.get<ApiResponse<Paginated<Timesheet>>>(
      "/team/timesheets",
      { params },
    );
    return unwrapApiData(response.data);
  }

  static async getTeam(id: string): Promise<Timesheet> {
    const response = await apiClient.get<ApiResponse<Timesheet>>(
      `/team/timesheets/${id}`,
    );
    return unwrapApiData(response.data);
  }

  static async approve(id: string, body: VersionedCommand): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/team/timesheets/${id}/approve`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }

  static async returnTimesheet(
    id: string,
    body: VersionedCommand,
  ): Promise<Timesheet> {
    const response = await apiClient.post<ApiResponse<Timesheet>>(
      `/team/timesheets/${id}/return`,
      {
        ...body,
        operationId: body.operationId || createOperationId(),
      },
    );
    return unwrapApiData(response.data);
  }
}
