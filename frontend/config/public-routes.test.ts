import { describe, expect, it } from "vitest";

import { isAnonymousPublicPath, isPublicApiRequest } from "./public-routes";

describe("isAnonymousPublicPath", () => {
  it("treats careers and offer-response as public", () => {
    expect(isAnonymousPublicPath("/careers/E2EATL-HQ-907CA2/jobs/JO-00001")).toBe(
      true,
    );
    expect(isAnonymousPublicPath("/offer-response")).toBe(true);
    expect(isAnonymousPublicPath("/privacy/recruitment")).toBe(true);
  });

  it("does not treat authenticated app routes as public", () => {
    expect(isAnonymousPublicPath("/dashboard")).toBe(false);
    expect(isAnonymousPublicPath("/hr/recruitment/openings")).toBe(false);
    expect(isAnonymousPublicPath("/login")).toBe(false);
  });
});

describe("isPublicApiRequest", () => {
  it("detects public careers API paths", () => {
    expect(
      isPublicApiRequest("/public/careers/E2EATL-HQ-907CA2/jobs/JO-00001"),
    ).toBe(true);
    expect(isPublicApiRequest("/api/public/careers/demo")).toBe(true);
  });

  it("does not treat auth or HR APIs as public", () => {
    expect(isPublicApiRequest("/auth/refresh")).toBe(false);
    expect(isPublicApiRequest("/employees")).toBe(false);
  });
});
