import { apiClient, refreshAuthSession, setAuthAccessToken } from "./api-client";
import type { ApiResponse } from "@/types/api";
import type {
  AuthCapabilities,
  AuthResponse,
  AuthSessionSummary,
  AuthUser,
  OrganizationRegistrationInput,
  RegistrationStartResponse,
  InvitationInspection,
  OrganizationScopeSelection,
  PasswordResetRequestResponse,
} from "@/types/auth";

export const authService = {
  async restore(): Promise<AuthResponse> {
    return refreshAuthSession();
  },

  async login(
    identifier: string,
    password: string,
    scope?: OrganizationScopeSelection
  ): Promise<AuthResponse> {
    const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/login", {
      identifier,
      password,
      ...scope,
    });
    setAuthAccessToken(data.data.accessToken);
    return data.data;
  },

  async capabilities(): Promise<AuthCapabilities> {
    const { data } = await apiClient.get<ApiResponse<AuthCapabilities>>("/auth/capabilities", {
      skipAuthRefresh: true,
    });
    return data.data;
  },

  async inspectInvitation(token: string): Promise<InvitationInspection> {
    const { data } = await apiClient.post<ApiResponse<InvitationInspection>>(
      "/auth/invitations/inspect",
      { token }
    );
    return data.data;
  },

  async acceptInvitation(
    token: string,
    password: string,
    scope?: OrganizationScopeSelection
  ): Promise<AuthResponse> {
    const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/invitations/accept", {
      token,
      password,
      ...scope,
    });
    setAuthAccessToken(data.data.accessToken);
    return data.data;
  },

  async forgotPassword(email: string): Promise<PasswordResetRequestResponse> {
    const { data } = await apiClient.post<ApiResponse<PasswordResetRequestResponse>>(
      "/auth/password/forgot",
      { email }
    );
    return data.data;
  },

  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const { data } = await apiClient.post<ApiResponse<{ reset: true }>>("/auth/password/reset", {
      token,
      password,
    });
    return data.data;
  },

  async registerOrganization(
    input: OrganizationRegistrationInput
  ): Promise<RegistrationStartResponse> {
    const { data } = await apiClient.post<ApiResponse<RegistrationStartResponse>>(
      "/auth/register-organization",
      input
    );
    return data.data;
  },

  async verifyOrganization(registrationId: string, code: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/registration/verify", {
      registrationId,
      code,
    });
    setAuthAccessToken(data.data.accessToken);
    return data.data;
  },

  async resendRegistration(registrationId: string): Promise<RegistrationStartResponse> {
    const { data } = await apiClient.post<ApiResponse<RegistrationStartResponse>>(
      "/auth/registration/resend",
      { registrationId }
    );
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await apiClient.get<ApiResponse<AuthUser>>("/auth/me");
    return data.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
    const { data } = await apiClient.post<ApiResponse<AuthResponse>>("/auth/change-password", {
      currentPassword,
      newPassword,
    });
    setAuthAccessToken(data.data.accessToken);
    return data.data;
  },

  async changeContext(
    companyId?: string,
    branchId?: string,
    companyGroupId?: string
  ): Promise<AuthResponse> {
    const { data } = await apiClient.patch<ApiResponse<AuthResponse>>("/auth/context", {
      companyId,
      branchId,
      companyGroupId,
    });
    setAuthAccessToken(data.data.accessToken);
    return data.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setAuthAccessToken(null);
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await apiClient.post("/auth/logout-all");
    } finally {
      setAuthAccessToken(null);
    }
  },

  async sessions(): Promise<AuthSessionSummary[]> {
    const { data } = await apiClient.get<ApiResponse<AuthSessionSummary[]>>("/auth/sessions");
    return data.data;
  },

  async revokeSession(sessionId: string): Promise<void> {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  },
};
