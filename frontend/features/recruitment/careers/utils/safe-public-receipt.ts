import {
  PUBLIC_APPLICATION_SUCCESS_MESSAGE,
} from "../constants/public-careers-content";
import type { PublicApplicationReceipt } from "../types/public-careers";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public receipts must never expose internal database IDs or UUIDs.
 * Application codes like APP-… are allowed as candidate-facing references.
 */
export function toSafePublicReceipt(input: {
  receiptReference?: string | null;
  message?: string | null;
}): PublicApplicationReceipt {
  const raw = (input.receiptReference ?? "").trim();
  const safeReference =
    !raw || UUID_PATTERN.test(raw) || raw.toLowerCase().includes("uuid")
      ? "RECEIVED"
      : raw.slice(0, 64);

  return {
    receiptReference: safeReference,
    message:
      input.message?.trim() || PUBLIC_APPLICATION_SUCCESS_MESSAGE,
  };
}
