import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

import {
  DEFAULT_POST_AUTH_PATH,
  appendNextQuery,
  clearAuthNext,
  consumePostAuthDestination,
  rememberAuthNext,
  resolveSafeNextPath,
} from "./auth-next-path";

describe("resolveSafeNextPath", () => {
  it("falls back for empty and external values", () => {
    expect(resolveSafeNextPath(null)).toBe(DEFAULT_POST_AUTH_PATH);
    expect(resolveSafeNextPath("https://evil.example/x")).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(resolveSafeNextPath("//evil.example/x")).toBe(DEFAULT_POST_AUTH_PATH);
    expect(resolveSafeNextPath("/login")).toBe(DEFAULT_POST_AUTH_PATH);
    expect(resolveSafeNextPath("/register")).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it("allows internal app paths including query", () => {
    expect(resolveSafeNextPath("/administration/designations")).toBe(
      "/administration/designations",
    );
    expect(resolveSafeNextPath("/hr/employees?tab=active")).toBe(
      "/hr/employees?tab=active",
    );
  });
});

describe("auth next session memory", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("remembers and consumes a safe destination", () => {
    rememberAuthNext("/projects/projects");
    expect(consumePostAuthDestination(null)).toBe("/projects/projects");
    expect(consumePostAuthDestination(null)).toBe(DEFAULT_POST_AUTH_PATH);
  });

  it("appendNextQuery skips dashboard default", () => {
    expect(appendNextQuery("/change-password", "/dashboard")).toBe(
      "/change-password",
    );
    expect(appendNextQuery("/change-password", "/hr/employees")).toContain(
      "next=%2Fhr%2Femployees",
    );
  });

  it("clearAuthNext removes stored value", () => {
    rememberAuthNext("/my-workspace");
    clearAuthNext();
    expect(consumePostAuthDestination(null)).toBe(DEFAULT_POST_AUTH_PATH);
  });
});
