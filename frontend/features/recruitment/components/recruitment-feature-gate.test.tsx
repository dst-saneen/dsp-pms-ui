import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname,
}));

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

import { RecruitmentFeatureGate } from "./recruitment-feature-gate";

describe("RecruitmentFeatureGate", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    usePathname.mockReturnValue("/hr/recruitment");
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { recruitmentNav: true },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("blocks internal recruitment when the backend capability is unavailable", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { recruitmentNav: false },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(
      <RecruitmentFeatureGate>
        <div>Recruitment workspace</div>
      </RecruitmentFeatureGate>,
    );

    expect(
      screen.getByText("This module is not enabled for the active Company and Branch."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Recruitment workspace")).not.toBeInTheDocument();
  });

  it("renders internal recruitment when the backend capability is available", () => {
    render(
      <RecruitmentFeatureGate>
        <div>Recruitment workspace</div>
      </RecruitmentFeatureGate>,
    );

    expect(screen.getByText("Recruitment workspace")).toBeInTheDocument();
  });

  it("uses the independent delivery capability for delivery-only routes", () => {
    usePathname.mockReturnValue("/hr/recruitment/delivery");
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { recruitmentNav: false, deliveryOperationsNav: true },
      isLoading: false,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    render(
      <RecruitmentFeatureGate>
        <div>Delivery workspace</div>
      </RecruitmentFeatureGate>,
    );

    expect(screen.getByText("Delivery workspace")).toBeInTheDocument();
  });

  it("keeps explicit development mock mode independent of backend capabilities", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_RECRUITMENT_USE_MOCK", "true");
    vi.mocked(useModuleCapabilities).mockClear();

    render(
      <RecruitmentFeatureGate>
        <div>Mock recruitment workspace</div>
      </RecruitmentFeatureGate>,
    );

    expect(screen.getByText("Mock recruitment workspace")).toBeInTheDocument();
    expect(useModuleCapabilities).not.toHaveBeenCalled();
  });
});
