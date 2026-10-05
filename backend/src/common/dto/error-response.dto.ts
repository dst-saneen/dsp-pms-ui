export interface ErrorDetailDto {
  field?: string;
  message: string;
}

export interface ErrorResponseDto {
  success: false;

  statusCode: number;

  error: string;

  code: string;

  message: string | string[];

  requestId: string;

  timestamp: string;

  path: string;

  method: string;

  details?: ErrorDetailDto[];

  availableScopes?: unknown[];
}
