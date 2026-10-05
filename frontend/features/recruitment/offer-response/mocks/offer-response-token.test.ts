import { beforeEach, describe, expect, it } from "vitest";

import { OfferResponseMockStore } from "./offer-response-mock-store";

describe("OfferResponseMockStore.issueToken", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps only one unconsumed token per offer after reissue", () => {
    const offerId = "offer-1";
    const first = OfferResponseMockStore.issueToken(
      offerId,
      new Date(Date.now() + 86_400_000).toISOString(),
    );
    const second = OfferResponseMockStore.issueToken(
      offerId,
      new Date(Date.now() + 86_400_000).toISOString(),
    );

    expect(first).not.toEqual(second);
    expect(OfferResponseMockStore.getTokenForOffer(offerId)).toBe(second);

    const firstInspect = OfferResponseMockStore.inspect(first);
    expect(firstInspect.canRespond).toBe(false);
    expect(firstInspect.state).toBe("INVALID");
  });
});
