import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JOB_OFFER_STATUS } from "../../types/enums";
import { OfferVersionHistory } from "./offer-version-history";

describe("OfferVersionHistory", () => {
  it("renders immutable sent versions without edit affordances", () => {
    render(
      <OfferVersionHistory
        offers={[
          {
            id: "offer-1",
            jobApplicationId: "application-1",
            applicationNumber: "APP-001",
            candidateName: "Alex Candidate",
            candidateEmail: "alex@example.com",
            jobOpeningId: "opening-1",
            openingCode: "JO-001",
            openingTitle: "Engineer",
            versionNumber: 1,
            status: JOB_OFFER_STATUS.SENT,
            version: 2,
            roleTitle: "Engineer",
            organization: {
              companyId: "c1",
              branchId: "b1",
              departmentId: "d1",
              designationId: "des1",
            },
            reportingManagerEmployeeId: "m1",
            employmentType: "FULL_TIME",
            joiningDate: "2026-02-01",
            compensation: { amount: 1000000, currency: "INR", period: "ANNUAL" },
            probationDays: 90,
            expiryDate: "2026-02-15",
            delivery: { status: "SENT" },
            sentAt: "2026-01-10T10:00:00.000Z",
            allowedActions: {
              canEdit: false,
              canPreview: true,
              canSend: false,
              canRetryDelivery: false,
              canRevoke: true,
              canRevise: true,
            },
            createdAt: "2026-01-09T10:00:00.000Z",
            updatedAt: "2026-01-10T10:00:00.000Z",
          },
        ]}
      />,
    );

    expect(screen.getByText("Version 1")).toBeInTheDocument();
    expect(screen.getAllByText("Sent").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
