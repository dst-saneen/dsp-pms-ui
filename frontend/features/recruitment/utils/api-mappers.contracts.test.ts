import { describe, expect, it } from "vitest";

import { mapCareerTimeline, mapJobOffer, mapOfferInspection } from "./api-mappers";

describe("recruitment API contract mappers", () => {
  it("maps persisted offer delivery status and retry availability", () => {
    const offer = mapJobOffer({
      id: "offer-1",
      jobApplicationId: "app-1",
      status: "SENT",
      versionNo: 1,
      sentAt: "2026-01-10T10:00:00.000Z",
      joiningDate: "2026-02-01",
      expiryDate: "2026-02-15",
      compensationAmount: 1000,
      reportingManagerEmployeeId: "mgr-1",
      delivery: {
        status: "FAILED",
        lastAttemptAt: "2026-01-10T10:05:00.000Z",
        failureReason: "SMTP_TIMEOUT",
        retryAvailable: true,
      },
      allowedActions: {
        canEdit: false,
        canPreview: true,
        canSend: false,
        canRetryDelivery: true,
        canRevoke: true,
        canRevise: true,
      },
    });

    expect(offer.delivery.status).toBe("FAILED");
    expect(offer.delivery.retryAvailable).toBe(true);
    expect(offer.allowedActions.canRetryDelivery).toBe(true);
    expect(offer).not.toHaveProperty("responseTokenHash");
    expect(offer.candidateResponseUrl).toBeUndefined();
  });

  it("maps sanitized public offer terminal states from the API payload", () => {
    expect(mapOfferInspection({ status: "EXPIRED", message: "Expired." }).state).toBe(
      "EXPIRED",
    );
    expect(mapOfferInspection({ status: "REVOKED", message: "Revoked." }).state).toBe(
      "REVOKED",
    );
    expect(mapOfferInspection({ status: "ACCEPTED", message: "Accepted." }).state).toBe(
      "ALREADY_ACCEPTED",
    );
    expect(mapOfferInspection({ status: "DECLINED", message: "Declined." }).state).toBe(
      "ALREADY_DECLINED",
    );
    expect(mapOfferInspection({ status: "SUPERSEDED", message: "Replaced." }).state).toBe(
      "SUPERSEDED",
    );
    expect(mapOfferInspection({ status: "UNKNOWN" }).state).toBe("INVALID");
  });

  it("uses the optimistic offer version for public accept, not versionNo", () => {
    const inspection = mapOfferInspection({
      status: "VALID",
      versionNo: 1,
      version: 4,
      offerVersion: 4,
      designationName: "Software Engineer",
    });

    expect(inspection.responseVersion).toBe(4);
    expect(inspection.offer?.versionNumber).toBe(1);
  });

  it("does not invent career milestones and strips HR detail for sanitized view", () => {
    const timeline = mapCareerTimeline("emp-1", "SANITIZED", {
      employeeId: "emp-1",
      events: [
        {
          id: "evt-1",
          eventType: "OFFER_ACCEPTED",
          eventAt: "2026-01-01T10:00:00.000Z",
          employeeVisibleSummary: "Offer accepted.",
          hrDetailReference: "Compensation 12 LPA",
        },
      ],
    });

    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0]?.summary).toBe("Offer accepted.");
    expect(timeline.events[0]?.hrDetail).toBeUndefined();
  });
});
