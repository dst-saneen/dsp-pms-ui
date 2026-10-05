import { describe, expect, it } from "vitest";

import {
  assertOfferTokenNotPersisted,
  redactTokenFromUrl,
} from "./offer-response-security";

describe("offer response security", () => {
  it("redacts token query parameters from URLs", () => {
    expect(redactTokenFromUrl("/offer-response?token=secret-token-value")).toBe(
      "/offer-response?token=%5BREDACTED%5D",
    );
  });

  it("detects persisted offer tokens in browser storage", () => {
    const storage = {
      getItem(key: string) {
        return key === "offer-response-token" ? "secret-token" : null;
      },
    };

    expect(() => assertOfferTokenNotPersisted(storage)).toThrow(
      /Offer token persisted/,
    );
  });
});
