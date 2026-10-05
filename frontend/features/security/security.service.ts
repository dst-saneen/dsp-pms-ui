import { apiClient } from "@/services/api-client";
import type { ApiResponse } from "@/types/api";
import type {
  CreateSecurityUserInput,
  SecurityRole,
  SecurityPermission,
  SecurityUser,
  UserStatus,
  CreateSecurityRoleInput,
  SecurityDeliveryResult,
  SecurityUserSession,
  SecurityUserAssignmentInput,
} from "./types";

export const securityService = {
  async users(): Promise<SecurityUser[]> {
    const { data } =
      await apiClient.get<ApiResponse<SecurityUser[]>>("/security/users");
    return data.data;
  },

  async roles(includeInactive = false): Promise<SecurityRole[]> {
    const { data } =
      await apiClient.get<ApiResponse<SecurityRole[]>>("/security/roles", {
        params: includeInactive ? { includeInactive: true } : undefined,
      });
    return data.data;
  },

  async permissions(): Promise<SecurityPermission[]> {
    const { data } = await apiClient.get<ApiResponse<SecurityPermission[]>>(
      "/security/permissions"
    );
    return data.data;
  },

  async createUser(
    input: CreateSecurityUserInput
  ): Promise<{
    user: SecurityUser;
    invitation: SecurityDeliveryResult;
  }> {
    const { data } = await apiClient.post<
      ApiResponse<{
        user: SecurityUser;
        invitation: SecurityDeliveryResult;
      }>
    >("/security/users", input);
    return data.data;
  },

  async updateStatus(userId: string, status: UserStatus): Promise<void> {
    await apiClient.patch(`/security/users/${userId}/status`, { status });
  },

  async resetPassword(userId: string): Promise<{
    accepted: true;
    message: string;
    developmentActionUrl?: string;
  }> {
    const { data } = await apiClient.post<
      ApiResponse<{
        accepted: true;
        message: string;
        developmentActionUrl?: string;
      }>
    >(`/security/users/${userId}/reset-password`);
    return data.data;
  },

  async resendInvitation(userId: string): Promise<SecurityDeliveryResult> {
    const { data } = await apiClient.post<ApiResponse<SecurityDeliveryResult>>(
      `/security/users/${userId}/invitations/resend`
    );
    return data.data;
  },

  async userSessions(userId: string): Promise<SecurityUserSession[]> {
    const { data } = await apiClient.get<ApiResponse<SecurityUserSession[]>>(
      `/security/users/${userId}/sessions`
    );
    return data.data;
  },

  async revokeUserSession(userId: string, sessionId: string): Promise<void> {
    await apiClient.delete(`/security/users/${userId}/sessions/${sessionId}`);
  },

  async replaceUserAssignments(
    userId: string,
    roleAssignments: SecurityUserAssignmentInput[]
  ): Promise<SecurityUser> {
    const { data } = await apiClient.put<ApiResponse<SecurityUser>>(
      `/security/users/${userId}/role-assignments`,
      { roleAssignments }
    );
    return data.data;
  },

  async createRole(input: CreateSecurityRoleInput): Promise<SecurityRole> {
    const { data } = await apiClient.post<ApiResponse<SecurityRole>>("/security/roles", input);
    return data.data;
  },

  async cloneRole(roleId: string, name?: string): Promise<SecurityRole> {
    const { data } = await apiClient.post<ApiResponse<SecurityRole>>(
      `/security/roles/${roleId}/clone`,
      { name }
    );
    return data.data;
  },

  async updateRole(
    roleId: string,
    input: { name?: string; description?: string }
  ): Promise<SecurityRole> {
    const { data } = await apiClient.patch<ApiResponse<SecurityRole>>(
      `/security/roles/${roleId}`,
      input
    );
    return data.data;
  },

  async replaceRolePermissions(
    roleId: string,
    permissionIds: string[]
  ): Promise<SecurityRole> {
    const { data } = await apiClient.put<ApiResponse<SecurityRole>>(
      `/security/roles/${roleId}/permissions`,
      { permissionIds }
    );
    return data.data;
  },

  async updateRoleStatus(roleId: string, isActive: boolean): Promise<SecurityRole> {
    const { data } = await apiClient.patch<ApiResponse<SecurityRole>>(
      `/security/roles/${roleId}/status`,
      { isActive }
    );
    return data.data;
  },
};
