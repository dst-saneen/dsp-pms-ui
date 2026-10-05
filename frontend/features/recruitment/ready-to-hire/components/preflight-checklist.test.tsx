import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PREFLIGHT_CHECK_CODES } from "../types/conversion-preflight";
import { PreflightChecklist } from "./preflight-checklist";

describe("PreflightChecklist", () => {
  it("renders blocked and passed checklist states with accessible labels", () => {
    render(
      <PreflightChecklist
        checks={[
          {
            code: PREFLIGHT_CHECK_CODES.OFFER_ACCEPTED,
            label: "Offer accepted",
            status: "PASSED",
            message: "Accepted offer v1 is on file.",
          },
          {
            code: PREFLIGHT_CHECK_CODES.POSITION_RESERVED,
            label: "Position reserved",
            status: "BLOCKED",
            message: "No reserved headcount is available for this opening.",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Conversion preflight checklist")).toBeInTheDocument();
    expect(screen.getByText("Offer accepted")).toBeInTheDocument();
    expect(screen.getByText("Accepted offer v1 is on file.")).toBeInTheDocument();
    expect(screen.getByLabelText("Position reserved: blocked")).toBeInTheDocument();
  });

  it("renders blocked remediation links when context is provided", () => {
    render(
      <PreflightChecklist
        checks={[
          {
            code: "POSITION_RESERVED",
            label: "Position reserved",
            status: "BLOCKED",
            message: "No reserved headcount is available for this opening.",
          },
        ]}
        remediationContext={{
          applicationId: "app-1",
          jobOpeningId: "open-1",
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Open job opening" })).toHaveAttribute(
      "href",
      "/hr/recruitment/openings/open-1",
    );
  });
});
