import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetForm } from "./asset-form";

vi.mock("@/features/lookups/hooks/use-companies", () => ({
  useCompanies: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/lookups/hooks/use-departments", () => ({
  useDepartments: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/asset-category/hooks/use-asset-categories", () => ({
  useAssetCategories: () => ({ data: { items: [] }, isLoading: false }),
}));

vi.mock("@/features/asset-type/hooks/use-asset-types", () => ({
  useAssetTypes: () => ({ data: { items: [] }, isLoading: false }),
}));

vi.mock("../hooks/use-asset-inbox", () => ({
  useAssetDepartments: () => ({ data: [] }),
}));

describe("AssetForm accessibility", () => {
  afterEach(cleanup);

  it("associates every initial asset form field with its visible label", () => {
    render(<AssetForm onSubmit={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: /^Company/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Department/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Asset Category/ })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Asset type/ })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /^Asset name/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Purchase Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Purchase Cost")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Currency" })).toBeInTheDocument();
    expect(screen.getByLabelText("Warranty expiry")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Remarks" })).toBeInTheDocument();
  });
});
