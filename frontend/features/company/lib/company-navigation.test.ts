import { describe, expect, it } from "vitest";

import * as companyNavigation from "./company-navigation";

describe("company Modules & Features navigation", () => {
  it("builds the Company-scoped modules route", () => {
    const modulesHref = (
      companyNavigation as unknown as {
        companyModulesHref(id: string): string;
      }
    ).companyModulesHref;

    expect(modulesHref("company-1")).toBe(
      "/administration/companies/company-1/modules",
    );
  });
});
