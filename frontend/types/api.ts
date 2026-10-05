export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  requestId: string;
  timestamp: string;
  path: string;
  method: string;
  details?: ApiErrorDetail[];
  availableScopes?: import("./auth").AvailableAuthorizationScope[];
}

export interface ApiError {
  message?: string;
  userMessage?: string;
  requestId?: string;
  response?: {
    data?: Omit<Partial<ApiErrorResponse>, "message"> & {
      message?: string;
    };
    headers?: Record<string, unknown>;
    status?: number;
  };
}
