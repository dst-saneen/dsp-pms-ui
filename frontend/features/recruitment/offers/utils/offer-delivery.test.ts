import { describe, expect, it } from "vitest";

import {
  formatOfferDeliveryStatus,
  isOfferDeliveryFailed,
  isOfferDeliveryPending,
  isOfferDeliverySent,
  normalizeOfferDeliveryStatus,
} from "./offer-delivery";

describe("offer delivery status", () => {
  it("normalizes persisted API statuses and legacy aliases", () => {
    expect(normalizeOfferDeliveryStatus("QUEUED")).toBe("QUEUED");
    expect(normalizeOfferDeliveryStatus("SENT")).toBe("SENT");
    expect(normalizeOfferDeliveryStatus("FAILED")).toBe("FAILED");
    expect(normalizeOfferDeliveryStatus("PENDING")).toBe("QUEUED");
    expect(normalizeOfferDeliveryStatus("DELIVERED")).toBe("SENT");
    expect(normalizeOfferDeliveryStatus(undefined, "2026-01-01")).toBe("QUEUED");
    expect(normalizeOfferDeliveryStatus(undefined)).toBe("NOT_SENT");
  });

  it("classifies queued, sent, and failed states", () => {
    expect(isOfferDeliveryPending("QUEUED")).toBe(true);
    expect(isOfferDeliverySent("SENT")).toBe(true);
    expect(isOfferDeliverySent("BYPASSED")).toBe(true);
    expect(isOfferDeliveryFailed("FAILED")).toBe(true);
    expect(formatOfferDeliveryStatus("QUEUED")).toBe("Queued");
    expect(formatOfferDeliveryStatus("FAILED")).toBe("Failed");
  });
});
