import { describe, expect, it } from "vitest";

import { JOB_APPLICATION_STATUS } from "../../types/enums";
import {
  applicationDirectoryHref,
  parseApplicationDirectoryFilters,
  toJobApplicationSearchParams,
} from "./application-navigation";

describe("application directory URL filters", () => {
  it("parses status, opening, branch, dates, search, and paging", () => {
    const filters = parseApplicationDirectoryFilters(
      new URLSearchParams(
        "q=bim&status=SCREENING&openingId=op-1&branchId=br-1&from=2026-01-01&to=2026-01-31&page=2&limit=25",
      ),
    );

    expect(filters).toEqual({
      search: "bim",
      status: "SCREENING",
      jobOpeningId: "op-1",
      branchId: "br-1",
      submittedFrom: "2026-01-01",
      submittedTo: "2026-01-31",
      page: 2,
      limit: 25,
    });

    expect(toJobApplicationSearchParams(filters)).toEqual({
      search: "bim",
      status: JOB_APPLICATION_STATUS.SCREENING,
      jobOpeningId: "op-1",
      branchId: "br-1",
      submittedFrom: "2026-01-01",
      submittedTo: "2026-01-31",
      page: 2,
      limit: 25,
    });
  });

  it("round-trips filters into a stable href", () => {
    const href = applicationDirectoryHref({
      search: "ada",
      status: "APPLIED",
      jobOpeningId: "",
      branchId: "br-9",
      submittedFrom: "",
      submittedTo: "",
      page: 1,
      limit: 20,
    });

    expect(href).toBe(
      "/hr/recruitment/applications?q=ada&status=APPLIED&branchId=br-9",
    );
  });
});
