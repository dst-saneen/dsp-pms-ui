import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as workspaceModule from "./company-modules-workspace";

const company = {
  id: "company-1",
  companyCode: "COM-001",
  companyName: "DSP India Services Pvt Ltd QA",
  isActive: true,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

const entitlements = [
  { module: "FINANCE" as const, isEnabled: false },
  { module: "FILE_STORAGE" as const, isEnabled: false },
  { module: "PAYROLL" as const, isEnabled: false },
];

afterEach(cleanup);

describe("CompanyModulesWorkspace", () => {
  it("enables dependencies and submits the resulting state", () => {
    const onSave = vi.fn();
    const Workspace = (
      workspaceModule as unknown as {
        CompanyModulesWorkspace: React.ComponentType<{
          company: typeof company;
          entitlements: typeof entitlements;
          canManage: boolean;
          isSaving: boolean;
          onSave: (value: unknown) => void;
          onBack: () => void;
        }>;
      }
    ).CompanyModulesWorkspace;

    render(
      <Workspace
        company={company}
        entitlements={entitlements}
        canManage
        isSaving={false}
        onSave={onSave}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: "Payroll" }));

    expect(screen.getByRole("switch", { name: "Finance" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "File storage" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        { module: "PAYROLL", isEnabled: true },
        { module: "FINANCE", isEnabled: true },
        { module: "FILE_STORAGE", isEnabled: true },
      ]),
    );
  });

  it("keeps the controls read-only without Company management permission", () => {
    const Workspace = (
      workspaceModule as unknown as {
        CompanyModulesWorkspace: React.ComponentType<{
          company: typeof company;
          entitlements: typeof entitlements;
          canManage: boolean;
          isSaving: boolean;
          onSave: (value: unknown) => void;
          onBack: () => void;
        }>;
      }
    ).CompanyModulesWorkspace;

    render(
      <Workspace
        company={company}
        entitlements={entitlements}
        canManage={false}
        isSaving={false}
        onSave={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch", { name: "Payroll" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
