import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { capabilities } = vi.hoisted(() => ({
  capabilities: vi.fn(),
}));

vi.mock("@/services/auth.service", () => ({
  authService: { capabilities },
}));

import { PublicCareersFeatureGate } from "./public-careers-feature-gate";

describe("PublicCareersFeatureGate", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    capabilities.mockReset();
  });

  it("renders public careers when the backend enables the public-careers capability", async () => {
    capabilities.mockResolvedValue({
      selfRegistrationEnabled: false,
      publicCareersEnabled: true,
    });

    render(
      <PublicCareersFeatureGate>
        <div>Public careers content</div>
      </PublicCareersFeatureGate>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Checking careers availability");
    expect(await screen.findByText("Public careers content")).toBeInTheDocument();
  });

  it("fails closed when public careers is unavailable from the backend", async () => {
    capabilities.mockResolvedValue({
      selfRegistrationEnabled: false,
      publicCareersEnabled: false,
    });

    render(
      <PublicCareersFeatureGate>
        <div>Public careers content</div>
      </PublicCareersFeatureGate>,
    );

    expect(await screen.findByText("Careers page not found")).toBeInTheDocument();
    expect(screen.queryByText("Public careers content")).not.toBeInTheDocument();
  });

  it("fails closed when the backend capability check cannot be completed", async () => {
    capabilities.mockRejectedValue(new Error("network failure"));

    render(
      <PublicCareersFeatureGate>
        <div>Public careers content</div>
      </PublicCareersFeatureGate>,
    );

    expect(await screen.findByText("Careers page not found")).toBeInTheDocument();
  });

  it("keeps explicit development mock mode independent of the backend", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "true");

    render(
      <PublicCareersFeatureGate>
        <div>Mock public careers content</div>
      </PublicCareersFeatureGate>,
    );

    expect(screen.getByText("Mock public careers content")).toBeInTheDocument();
    expect(capabilities).not.toHaveBeenCalled();
  });
});
