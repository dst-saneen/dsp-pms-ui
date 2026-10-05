import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetService } from "../services/asset-service";
import type { Asset } from "../types/asset";
import { AssetLicenseWorkspace } from "./asset-license-workspace";

function licensePool(id: string, assetName: string, seatCapacity: number): Asset {
  return {
    id,
    companyId: "company-1",
    assetTypeId: "license-type",
    assetCode: id,
    assetName,
    kind: "SOFTWARE_LICENSE",
    trackingMode: "POOL",
    lifecycleStatus: "IN_SERVICE",
    status: "ACTIVE",
    isActive: true,
    version: 1,
    allowedActions: ["READ"],
    softwareLicenseDetail: { seatCapacity },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderWorkspace(pools: Asset[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(["assets", "license-pools"], {
    items: pools,
    total: pools.length,
    page: 1,
    limit: 100,
  });
  vi.spyOn(AssetService, "getLicenseAllocationPage").mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  vi.spyOn(AssetService, "getEligibleEmployees").mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    limit: 100,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AssetLicenseWorkspace />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("AssetLicenseWorkspace pool selection", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the only pool and uses its capacity without a selection click", async () => {
    renderWorkspace([licensePool("pool-a", "Alpha licence", 5)]);

    expect(await screen.findByRole("heading", { name: "Alpha licence" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Total seats" })).toHaveValue("5");
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    await waitFor(() =>
      expect(AssetService.getLicenseAllocationPage).toHaveBeenCalledWith({
        assetId: "pool-a",
        limit: 100,
      }),
    );
  });

  it("starts each selected pool from its own capacity after editing another pool", async () => {
    renderWorkspace([
      licensePool("pool-a", "Alpha licence", 5),
      licensePool("pool-b", "Beta licence", 8),
    ]);

    fireEvent.click(screen.getAllByRole("button", { name: "View people" })[0]);
    const seatInput = screen.getByRole("textbox", { name: "Total seats" });
    expect(seatInput).toHaveValue("5");
    fireEvent.change(seatInput, { target: { value: "7" } });
    expect(seatInput).toHaveValue("7");

    fireEvent.click(screen.getByRole("button", { name: "View people" }));
    expect(seatInput).toHaveValue("8");
    fireEvent.click(screen.getByRole("button", { name: "View people" }));
    expect(seatInput).toHaveValue("5");
  });

  it("uses a refreshed pool capacity when the server value changes", async () => {
    const queryClient = renderWorkspace([
      licensePool("pool-a", "Alpha licence", 5),
    ]);
    const seatInput = await screen.findByRole("textbox", { name: "Total seats" });
    fireEvent.change(seatInput, { target: { value: "7" } });

    act(() => {
      queryClient.setQueryData(["assets", "license-pools"], {
        items: [licensePool("pool-a", "Alpha licence", 9)],
        total: 1,
        page: 1,
        limit: 100,
      });
    });

    await waitFor(() => expect(seatInput).toHaveValue("9"));
  });

  it("keeps the original pool as the resize target when a second pool appears", async () => {
    const alpha = licensePool("pool-a", "Alpha licence", 5);
    const beta = licensePool("pool-b", "Beta licence", 8);
    const queryClient = renderWorkspace([alpha]);
    vi.spyOn(AssetService, "getAll").mockResolvedValue({
      items: [alpha, beta],
      total: 2,
      page: 1,
      limit: 100,
    });
    const resize = vi
      .spyOn(AssetService, "resizeLicensePool")
      .mockResolvedValue(licensePool("pool-a", "Alpha licence", 7));

    fireEvent.change(screen.getByRole("textbox", { name: "Total seats" }), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update total" }));
    act(() => {
      queryClient.setQueryData(["assets", "license-pools"], {
        items: [alpha, beta],
        total: 2,
        page: 1,
        limit: 100,
      });
    });

    expect(await screen.findByText("Beta licence")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "Alpha licence",
        hidden: true,
      }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Reason" }), {
      target: { value: "Add two seats" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Update$/ }));
    await waitFor(() =>
      expect(resize).toHaveBeenCalledWith(
        "pool-a",
        expect.objectContaining({
          expectedVersion: 1,
          seatCapacity: 7,
          reason: "Add two seats",
        }),
      ),
    );
  });

  it("does not restore an old draft if capacity changes away and back", async () => {
    const queryClient = renderWorkspace([
      licensePool("pool-a", "Alpha licence", 5),
    ]);
    const seatInput = screen.getByRole("textbox", { name: "Total seats" });
    fireEvent.change(seatInput, { target: { value: "7" } });

    act(() => {
      queryClient.setQueryData(["assets", "license-pools"], {
        items: [licensePool("pool-a", "Alpha licence", 9)],
        total: 1,
        page: 1,
        limit: 100,
      });
    });
    await waitFor(() => expect(seatInput).toHaveValue("9"));

    act(() => {
      queryClient.setQueryData(["assets", "license-pools"], {
        items: [licensePool("pool-a", "Alpha licence", 5)],
        total: 1,
        page: 1,
        limit: 100,
      });
    });
    await waitFor(() => expect(seatInput).toHaveValue("5"));
  });

  it("keeps an edited capacity when opening the already selected pool", () => {
    renderWorkspace([licensePool("pool-a", "Alpha licence", 5)]);
    const seatInput = screen.getByRole("textbox", { name: "Total seats" });
    fireEvent.change(seatInput, { target: { value: "7" } });

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(seatInput).toHaveValue("7");
  });
});
