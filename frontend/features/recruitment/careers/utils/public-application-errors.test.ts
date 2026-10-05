import { describe, expect, it } from "vitest";

import {
  classifyPublicApplicationError,
  getPublicApplicationErrorMessage,
} from "./public-application-errors";

describe("public application error mapping", () => {
  it("maps abuse and validation codes without enumerating candidates", () => {
    expect(getPublicApplicationErrorMessage(new Error("RATE_LIMITED"))).toBe(
      "Too many applications. Please try again later.",
    );
    expect(getPublicApplicationErrorMessage(new Error("TURNSTILE_INVALID"))).toBe(
      "Verification failed. Please try again.",
    );
    expect(getPublicApplicationErrorMessage(new Error("BOT_DETECTED"))).toBe(
      "We could not submit your application. Please try again.",
    );
    expect(
      getPublicApplicationErrorMessage(new Error("RECRUITMENT_STORAGE_UNAVAILABLE")),
    ).toBe(
      "Document storage is temporarily unavailable. Please try again shortly.",
    );
  });

  it("classifies scan and storage failures for recovery UI", () => {
    expect(
      classifyPublicApplicationError(new Error("RECRUITMENT_DOCUMENT_INFECTED")),
    ).toMatchObject({
      recovery: "replace_cv",
      scanStatus: "INFECTED",
    });

    expect(
      classifyPublicApplicationError(
        new Error("RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE"),
      ),
    ).toMatchObject({
      recovery: "wait_and_retry",
      scanStatus: "SCANNER_UNAVAILABLE",
    });

    expect(
      classifyPublicApplicationError(new Error("OPENING_NOT_OPEN")),
    ).toMatchObject({
      recovery: "opening_closed",
    });
  });
});
