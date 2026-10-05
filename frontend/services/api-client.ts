import axios, { AxiosError } from "axios";

import { API_CONFIG } from "@/config/api";
import { isPublicApiRequest } from "@/config/public-routes";
import type { ApiErrorResponse, ApiResponse } from "@/types/api";
import type { AuthResponse, AvailableAuthorizationScope } from "@/types/auth";

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
  }
}

const REQUEST_ID_HEADER = "X-Request-ID";
const NETWORK_ERROR_MESSAGE = "Unable to connect to the server. Please try again.";
const DEFAULT_ERROR_MESSAGE = "The request could not be completed. Please try again.";

type NormalizedAxiosError = AxiosError<ApiErrorResponse> & {
  requestId?: string;
  userMessage?: string;
};

type RetryableRequest = NonNullable<AxiosError["config"]> & {
  _authRetry?: boolean;
  skipAuthRefresh?: boolean;
};

let accessToken: string | null = null;
let accessTokenGeneration = 0;
let refreshPromise: Promise<AuthResponse> | null = null;

export function setAuthAccessToken(token: string | null): void {
  accessToken = token;
  accessTokenGeneration += 1;
}

export function getAuthAccessToken(): string | null {
  return accessToken;
}

export async function refreshAuthSession(): Promise<AuthResponse> {
  if (!refreshPromise) {
    const refreshGeneration = accessTokenGeneration;
    refreshPromise = axios
      .post<ApiResponse<AuthResponse>>(
        `${API_CONFIG.BASE_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          timeout: API_CONFIG.TIMEOUT,
          headers: {
            [REQUEST_ID_HEADER]: createRequestId(),
          },
        }
      )
      .then((response) => {
        if (accessTokenGeneration === refreshGeneration) {
          setAuthAccessToken(response.data.data.accessToken);
        }
        return response.data.data;
      })
      .catch((error) => {
        if (accessTokenGeneration === refreshGeneration) {
          setAuthAccessToken(null);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("erp:auth-expired"));
          }
        }
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function readHeader(headers: unknown, headerName: string): string | undefined {
  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  const headersWithGet = headers as {
    get?: (name: string) => unknown;
    [key: string]: unknown;
  };
  const getValue = headersWithGet.get?.(headerName);

  if (typeof getValue === "string" && getValue.trim()) {
    return getValue.trim();
  }

  const directValue = headersWithGet[headerName] ?? headersWithGet[headerName.toLowerCase()];

  return typeof directValue === "string" && directValue.trim() ? directValue.trim() : undefined;
}

function resolveRequestId(error: AxiosError<ApiErrorResponse>): string | undefined {
  return (
    error.response?.data?.requestId ||
    readHeader(error.response?.headers, REQUEST_ID_HEADER) ||
    readHeader(error.config?.headers, REQUEST_ID_HEADER)
  );
}

function withReference(message: string, requestId: string | undefined): string {
  if (!requestId || message.includes(requestId)) {
    return message;
  }

  return `${message} Reference: ${requestId}`;
}

function normalizeResponseMessage(message: string | string[] | undefined): string | undefined {
  return Array.isArray(message) ? message.join(". ") : message;
}

function extractResponseMessage(data: unknown): string | undefined {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object" && "message" in data) {
    return normalizeResponseMessage((data as { message?: string | string[] }).message);
  }

  return undefined;
}

export function isVersionConflictError(error: unknown): boolean {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return false;
  }

  if (error.response?.status === 409) {
    return true;
  }

  const code = getApiErrorCode(error) ?? "";
  return code.includes("STATE_CHANGED") || code.includes("VERSION_CONFLICT");
}

export function getApiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return undefined;
  }

  const code = error.response?.data?.code;
  return typeof code === "string" && code.trim() ? code.trim() : undefined;
}

export function getRequiredOrganizationScopes(
  error: unknown
): AvailableAuthorizationScope[] | undefined {
  if (
    !axios.isAxiosError<ApiErrorResponse>(error) ||
    error.response?.data?.code !== "ORGANIZATION_SCOPE_SELECTION_REQUIRED"
  ) {
    return undefined;
  }

  const scopes = error.response.data.availableScopes;
  return Array.isArray(scopes) && scopes.length > 1 ? scopes : undefined;
}

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return fallback;
  }

  const normalizedError = error as NormalizedAxiosError;

  return (
    normalizedError.userMessage ||
    extractResponseMessage(normalizedError.response?.data) ||
    fallback
  );
}

export function getApiErrorRequestId(error: unknown): string | undefined {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return undefined;
  }

  const normalizedError = error as NormalizedAxiosError;

  return normalizedError.requestId || resolveRequestId(normalizedError);
}

/**
 * Backend ResponseInterceptor wraps payloads as `{ success, data }`.
 * Axios `response.data` is that envelope; this returns the inner payload.
 */
export function unwrapApiData<T>(payload: T | ApiResponse<T>): T {
  if (payload && typeof payload === "object" && "success" in payload && "data" in payload) {
    return (payload as ApiResponse<T>).data;
  }

  return payload as T;
}

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  if (!readHeader(config.headers, REQUEST_ID_HEADER)) {
    config.headers.set(REQUEST_ID_HEADER, createRequestId());
  }

  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    const normalizedError = error as NormalizedAxiosError;
    const requestId = resolveRequestId(error);
    const statusCode = error.response?.status;
    const responseMessage = extractResponseMessage(error.response?.data);
    let userMessage = responseMessage || DEFAULT_ERROR_MESSAGE;

    if (!error.response) {
      userMessage = NETWORK_ERROR_MESSAGE;
    } else if (statusCode && statusCode >= 500) {
      userMessage = withReference(userMessage, requestId);

      if (error.response.data && typeof error.response.data === "object") {
        (error.response.data as ApiErrorResponse).message = userMessage;
      }
    }

    normalizedError.requestId = requestId;
    normalizedError.userMessage = userMessage;
    normalizedError.message = userMessage;

    const request = error.config as RetryableRequest | undefined;
    const requestUrl = `${request?.baseURL ?? ""}${request?.url ?? ""}`;
    const isAuthenticationRequest = requestUrl.includes("/auth/");
    const skipAuthRefresh = request?.skipAuthRefresh === true || isPublicApiRequest(requestUrl);

    if (
      statusCode === 401 &&
      request &&
      !request._authRetry &&
      !isAuthenticationRequest &&
      !skipAuthRefresh &&
      typeof window !== "undefined"
    ) {
      request._authRetry = true;

      try {
        await refreshAuthSession();
        request.headers.set("Authorization", `Bearer ${accessToken}`);
        return apiClient.request(request);
      } catch {
        // refreshAuthSession only expires the token generation it attempted.
        // A newer successful login must remain authenticated.
      }
    }

    return Promise.reject(normalizedError);
  }
);
