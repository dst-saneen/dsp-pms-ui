import axios from "axios";

import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";
import type { ScanLifecycleStatus } from "@/components/file-upload/malware-scan-status";

const SAFE_PUBLIC_APPLY_MESSAGE =
  "We could not submit your application. Please try again.";

export type PublicApplyRecoveryKind =
  | "none"
  | "replace_cv"
  | "wait_and_retry"
  | "opening_closed";

export interface PublicApplyErrorInfo {
  message: string;
  recovery: PublicApplyRecoveryKind;
  /** When set, drive MalwareScanStatus in the documents step. */
  scanStatus?: ScanLifecycleStatus;
  safeErrorCode?: string;
}

const PUBLIC_APPLY_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "Too many applications. Please try again later.",
  TURNSTILE_REQUIRED: "Please complete the verification challenge.",
  TURNSTILE_INVALID: "Verification failed. Please try again.",
  TURNSTILE_UNAVAILABLE:
    "Application verification is unavailable. Please try again later.",
  PRIVACY_ACK_REQUIRED: "Privacy acknowledgement is required.",
  CV_REQUIRED: "A CV upload is required.",
  OPENING_NOT_FOUND: "This opening is no longer accepting applications.",
  COMPANY_NOT_FOUND: "This careers page is not available.",
  OPENING_NOT_OPEN: "This opening is no longer accepting applications.",
  RECRUITMENT_STORAGE_UNAVAILABLE:
    "Document storage is temporarily unavailable. Please try again shortly.",
  RECRUITMENT_DOCUMENT_TYPE_INVALID: "CV must be a PDF, DOC, or DOCX file.",
  RECRUITMENT_DOCUMENT_MIME_INVALID: "CV must be a PDF, DOC, or DOCX file.",
  RECRUITMENT_DOCUMENT_SIGNATURE_INVALID:
    "CV content does not match the file type. Please upload a real PDF, DOC, or DOCX.",
  RECRUITMENT_DOCUMENT_SIZE_INVALID: "CV must be 10 MB or smaller.",
  RECRUITMENT_DOCUMENT_INFECTED:
    "The CV failed the security scan. Choose a different file and try again.",
  RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE:
    "Security scanning is temporarily unavailable. Please try again shortly.",
  CLAMAV_UNAVAILABLE:
    "Security scanning is temporarily unavailable. Please try again shortly.",
  CLAMAV_TIMEOUT:
    "Security scanning timed out. Please try again with the same or another file.",
  FILE_INFECTED:
    "The CV failed the security scan. Choose a different file and try again.",
};

function resolveCode(error: unknown): string | null {
  if (error instanceof Error) {
    if (PUBLIC_APPLY_MESSAGES[error.message]) return error.message;
  }
  return getApiErrorCode(error) ?? null;
}

export function classifyPublicApplicationError(
  error: unknown,
  fallback = SAFE_PUBLIC_APPLY_MESSAGE,
): PublicApplyErrorInfo {
  if (axios.isAxiosError(error) && error.response?.status === 429) {
    return {
      message: PUBLIC_APPLY_MESSAGES.RATE_LIMITED,
      recovery: "wait_and_retry",
    };
  }

  const code = resolveCode(error);

  if (!code || !PUBLIC_APPLY_MESSAGES[code]) {
    return {
      message: getApiErrorMessage(error, fallback),
      recovery: "none",
    };
  }

  const message = PUBLIC_APPLY_MESSAGES[code];

  switch (code) {
    case "RECRUITMENT_DOCUMENT_INFECTED":
    case "FILE_INFECTED":
      return {
        message,
        recovery: "replace_cv",
        scanStatus: "INFECTED",
        safeErrorCode: code,
      };
    case "RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE":
    case "CLAMAV_UNAVAILABLE":
    case "CLAMAV_TIMEOUT":
    case "RECRUITMENT_STORAGE_UNAVAILABLE":
      return {
        message,
        recovery: "wait_and_retry",
        scanStatus: "SCANNER_UNAVAILABLE",
        safeErrorCode: code,
      };
    case "RECRUITMENT_DOCUMENT_TYPE_INVALID":
    case "RECRUITMENT_DOCUMENT_MIME_INVALID":
    case "RECRUITMENT_DOCUMENT_SIGNATURE_INVALID":
    case "RECRUITMENT_DOCUMENT_SIZE_INVALID":
    case "CV_REQUIRED":
      return {
        message,
        recovery: "replace_cv",
        scanStatus: "FAILED",
        safeErrorCode: code,
      };
    case "OPENING_NOT_FOUND":
    case "OPENING_NOT_OPEN":
      return {
        message,
        recovery: "opening_closed",
      };
    case "RATE_LIMITED":
    case "TURNSTILE_UNAVAILABLE":
      return {
        message,
        recovery: "wait_and_retry",
      };
    default:
      return {
        message,
        recovery: "none",
      };
  }
}

export function getPublicApplicationErrorMessage(
  error: unknown,
  fallback = SAFE_PUBLIC_APPLY_MESSAGE,
) {
  return classifyPublicApplicationError(error, fallback).message;
}
