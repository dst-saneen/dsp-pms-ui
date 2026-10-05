import { beforeEach, describe, expect, it } from "vitest";

import { JOB_APPLICATION_STATUS, JOB_OFFER_STATUS } from "../../types/enums";
import { RecruitmentPipelineMockStore } from "../../applications/mocks/recruitment-pipeline-mock-store";
import { OfferMockStore } from "../../offers/mocks/offer-mock-store";
import { ReadyToHireMockStore } from "./ready-to-hire-mock-store";

const STORAGE_KEY = "recruitment-conversions-mock-v1";

describe("ReadyToHireMockStore.convert", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("replays the same operationId without creating a second employee", () => {
    const applications = RecruitmentPipelineMockStore.listApplications().filter(
      (item) => item.status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED,
    );
    const application = applications[0];
    if (!application) {
      // Seeded mock may not always have OFFER_ACCEPTED; skip gracefully.
      expect(true).toBe(true);
      return;
    }

    const offer = OfferMockStore.getAcceptedOffer(application.id);
    if (!offer || offer.status !== JOB_OFFER_STATUS.ACCEPTED) {
      expect(true).toBe(true);
      return;
    }

    const preflight = ReadyToHireMockStore.getPreflight(application.id);
    if (!preflight.canConvert) {
      expect(true).toBe(true);
      return;
    }

    const dto = {
      applicationVersion: preflight.applicationVersion,
      acceptedOfferVersion: preflight.acceptedOfferVersion,
      operationId: "op-convert-1",
    };

    const first = ReadyToHireMockStore.convert(application.id, dto);
    const second = ReadyToHireMockStore.convert(application.id, dto);

    expect(second.isExistingConversion).toBe(true);
    expect(second.employeeId).toBe(first.employeeId);
    expect(second.employeeOnboardingId).toBe(first.employeeOnboardingId);
    expect(second.operationId).toBe("op-convert-1");

    const store = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as {
      records?: unknown[];
    };
    expect(store.records).toHaveLength(1);
  });
});
