import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAuthAccessToken,
  getRequiredOrganizationScopes,
  refreshAuthSession,
  setAuthAccessToken,
} from "./api-client";

afterEach(() => {
  vi.restoreAllMocks();
  setAuthAccessToken(null);
});

describe("getRequiredOrganizationScopes", () => {
  it("returns the explicit choices from a scope-selection response", () => {
    const availableScopes = [
      { scope: "COMPANY" as const, companyId: "company-a" },
      { scope: "COMPANY" as const, companyId: "company-b" },
    ];
    const error = {
      isAxiosError: true,
      response: {
        data: {
          code: "ORGANIZATION_SCOPE_SELECTION_REQUIRED",
          availableScopes,
        },
      },
    };

    expect(getRequiredOrganizationScopes(error)).toEqual(availableScopes);
  });

  it("does not treat a generic conflict as a scope-selection response", () => {
    const error = {
      isAxiosError: true,
      response: {
        data: {
          code: "CONFLICT",
          availableScopes: [
            { scope: "COMPANY" as const, companyId: "company-a" },
            { scope: "COMPANY" as const, companyId: "company-b" },
          ],
        },
      },
    };

    expect(getRequiredOrganizationScopes(error)).toBeUndefined();
  });
});

describe("refreshAuthSession", () => {
  const authResponse = {
    accessToken: "refreshed-access-token",
    expiresIn: 900,
    user: {
      id: "user-id",
      username: "qa-owner",
      mustChangePassword: false,
      sessionId: "session-id",
      authorization: {
        roles: [],
        permissions: [],
        scopeLevel: "COMPANY" as const,
        isGlobal: false,
        availableScopes: [],
      },
    },
  };

  it("shares one refresh request between simultaneous callers", async () => {
    let resolveRequest!: (value: { data: { data: typeof authResponse } }) => void;
    const request = new Promise<{ data: { data: typeof authResponse } }>((resolve) => {
      resolveRequest = resolve;
    });
    const post = vi.spyOn(axios, "post").mockReturnValue(request as never);

    const first = refreshAuthSession();
    const second = refreshAuthSession();
    expect(post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { data: authResponse } });
    await expect(Promise.all([first, second])).resolves.toEqual([authResponse, authResponse]);
    expect(getAuthAccessToken()).toBe(authResponse.accessToken);
  });

  it("clears a failed single-flight request so a later retry can succeed", async () => {
    const post = vi
      .spyOn(axios, "post")
      .mockRejectedValueOnce(new Error("temporary refresh failure"))
      .mockResolvedValueOnce({ data: { data: authResponse } });

    await expect(refreshAuthSession()).rejects.toThrow("temporary refresh failure");
    await expect(refreshAuthSession()).resolves.toEqual(authResponse);
    expect(post).toHaveBeenCalledTimes(2);
    expect(getAuthAccessToken()).toBe(authResponse.accessToken);
  });

  it("does not clear a newer login token when an earlier refresh rejects", async () => {
    let rejectRequest!: (reason?: unknown) => void;
    const request = new Promise<{ data: { data: typeof authResponse } }>((_, reject) => {
      rejectRequest = reject;
    });
    vi.spyOn(axios, "post").mockReturnValue(request as never);

    const staleRefresh = refreshAuthSession();
    setAuthAccessToken("new-login-access-token");
    rejectRequest(new Error("stale refresh failure"));

    await expect(staleRefresh).rejects.toThrow("stale refresh failure");
    expect(getAuthAccessToken()).toBe("new-login-access-token");
  });

  it("does not overwrite a newer login token when an earlier refresh succeeds", async () => {
    let resolveRequest!: (value: { data: { data: typeof authResponse } }) => void;
    const request = new Promise<{ data: { data: typeof authResponse } }>((resolve) => {
      resolveRequest = resolve;
    });
    vi.spyOn(axios, "post").mockReturnValue(request as never);

    const staleRefresh = refreshAuthSession();
    setAuthAccessToken("new-login-access-token");
    resolveRequest({ data: { data: authResponse } });

    await expect(staleRefresh).resolves.toEqual(authResponse);
    expect(getAuthAccessToken()).toBe("new-login-access-token");
  });
});
