import { describe, expect, it } from "vitest";

import * as companyModules from "./company-modules";

type ModuleCode =
  | "ASSETS"
  | "DELIVERY"
  | "FILE_STORAGE"
  | "FINANCE"
  | "ONBOARDING"
  | "PAYROLL"
  | "PROJECTS"
  | "RECRUITMENT"
  | "RECRUITMENT_SHORTLIST";

const allDisabled = Object.fromEntries(
  [
    "ASSETS",
    "DELIVERY",
    "FILE_STORAGE",
    "FINANCE",
    "ONBOARDING",
    "PAYROLL",
    "PROJECTS",
    "RECRUITMENT",
    "RECRUITMENT_SHORTLIST",
  ].map((module) => [module, false]),
) as Record<ModuleCode, boolean>;

describe("Company module dependency behavior", () => {
  it("enables Payroll dependencies with Payroll", () => {
    const applyToggle = (
      companyModules as unknown as {
        applyCompanyModuleToggle(
          values: Record<ModuleCode, boolean>,
          module: ModuleCode,
          enabled: boolean,
        ): Record<ModuleCode, boolean>;
      }
    ).applyCompanyModuleToggle;

    expect(applyToggle(allDisabled, "PAYROLL", true)).toMatchObject({
      PAYROLL: true,
      FINANCE: true,
      FILE_STORAGE: true,
    });
  });

  it("disables Payroll when Finance is disabled", () => {
    const applyToggle = (
      companyModules as unknown as {
        applyCompanyModuleToggle(
          values: Record<ModuleCode, boolean>,
          module: ModuleCode,
          enabled: boolean,
        ): Record<ModuleCode, boolean>;
      }
    ).applyCompanyModuleToggle;

    expect(
      applyToggle(
        { ...allDisabled, PAYROLL: true, FINANCE: true, FILE_STORAGE: true },
        "FINANCE",
        false,
      ),
    ).toMatchObject({ PAYROLL: false, FINANCE: false, FILE_STORAGE: true });
  });

  it("disables Recruitment shortlist when Recruitment is disabled", () => {
    const applyToggle = (
      companyModules as unknown as {
        applyCompanyModuleToggle(
          values: Record<ModuleCode, boolean>,
          module: ModuleCode,
          enabled: boolean,
        ): Record<ModuleCode, boolean>;
      }
    ).applyCompanyModuleToggle;

    expect(
      applyToggle(
        { ...allDisabled, RECRUITMENT: true, RECRUITMENT_SHORTLIST: true },
        "RECRUITMENT",
        false,
      ),
    ).toMatchObject({ RECRUITMENT: false, RECRUITMENT_SHORTLIST: false });
  });
});
