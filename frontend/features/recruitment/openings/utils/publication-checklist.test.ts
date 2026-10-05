import { describe, expect, it } from "vitest";

import { JOB_OPENING_STATUS } from "../../types/enums";
import type { JobOpening } from "../types/job-opening";
import { buildPublicationChecklist } from "./publication-checklist";

function createOpening(overrides: Partial<JobOpening> = {}): JobOpening {
  const future = new Date();
  future.setDate(future.getDate() + 14);

  return {
    id: "opening-1",
    openingCode: "ENG-001",
    title: "BIM Engineer",
    status: JOB_OPENING_STATUS.DRAFT,
    version: 1,
    companyGroupId: "11111111-1111-1111-1111-111111111111",
    companyId: "22222222-2222-2222-2222-222222222222",
    branchId: "33333333-3333-3333-3333-333333333333",
    departmentId: "44444444-4444-4444-4444-444444444444",
    designationId: "55555555-5555-5555-5555-555555555555",
    hiringManagerEmployeeId: "66666666-6666-6666-6666-666666666666",
    employmentType: "FULL_TIME",
    headcount: { approved: 1, used: 0, reserved: 0, remaining: 1 },
    applicationDeadline: future.toISOString().slice(0, 10),
    criteria: [
      {
        id: "c1",
        name: "Technical",
        weightPercentage: 60,
        displayOrder: 1,
        isRequired: true,
        isActive: true,
      },
      {
        id: "c2",
        name: "Communication",
        weightPercentage: 40,
        displayOrder: 2,
        isRequired: true,
        isActive: true,
      },
    ],
    allowedActions: {
      canEdit: true,
      canPublish: false,
      canHold: false,
      canReopen: false,
      canClose: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildPublicationChecklist", () => {
  it("allows publish when all server checklist items pass", () => {
    const checklist = buildPublicationChecklist(createOpening());

    expect(checklist.canPublish).toBe(true);
    expect(checklist.items.every((item) => item.passed)).toBe(true);
  });

  it("blocks publish when criteria total is not 100%", () => {
    const checklist = buildPublicationChecklist(
      createOpening({
        criteria: [
          {
            id: "c1",
            name: "Technical",
            weightPercentage: 70,
            displayOrder: 1,
            isRequired: true,
            isActive: true,
          },
          {
            id: "c2",
            name: "Communication",
            weightPercentage: 20,
            displayOrder: 2,
            isRequired: true,
            isActive: true,
          },
        ],
      }),
    );

    expect(checklist.canPublish).toBe(false);
    expect(
      checklist.items.find((item) => item.code === "CRITERIA_TOTAL_100")?.passed,
    ).toBe(false);
  });
});
