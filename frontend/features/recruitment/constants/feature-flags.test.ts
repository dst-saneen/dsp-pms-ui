import { afterEach, describe, expect, it, vi } from "vitest";

import { isRecruitmentMockEnabled } from "./feature-flags";

describe("recruitment mock mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the live API when the mock flag is omitted", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "");

    expect(isRecruitmentMockEnabled()).toBe(false);
  });

  it("uses the live API when the mock flag is explicitly false", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "false");

    expect(isRecruitmentMockEnabled()).toBe(false);
  });

  it("enables mock mode only when explicitly true in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "true");

    expect(isRecruitmentMockEnabled()).toBe(true);
  });

  it("never enables mock mode in production builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "true");

    expect(isRecruitmentMockEnabled()).toBe(false);
  });
});
