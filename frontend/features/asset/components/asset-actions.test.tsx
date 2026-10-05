import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetActions } from "./asset-actions";

vi.mock("@/features/lookups/hooks/use-departments", () => ({
  useDepartments: () => ({ data: [] }),
}));

vi.mock("../hooks/use-archive-asset", () => ({
  useArchiveAsset: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe("AssetActions accessibility", () => {
  afterEach(cleanup);

  it("names each asset row's action menu with the asset it affects", () => {
    render(
      <AssetActions
        asset={
          {
            id: "asset-1",
            assetName: "QA laptop",
            companyId: "company-1",
            allowedActions: ["UPDATE_METADATA"],
          } as never
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Actions for QA laptop" })).toBeInTheDocument();
  });
});
