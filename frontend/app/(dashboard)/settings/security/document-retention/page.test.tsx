import { cleanup, render, screen } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DocumentRetentionPage from "./page";

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({ isPending: false, mutate: vi.fn() })),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/services/api-client", () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
  getApiErrorMessage: vi.fn(),
  unwrapApiData: vi.fn(),
}));

const policies = [
  {
    id: "public-upload-orphan",
    retentionClass: "PUBLIC_UPLOAD_ORPHAN",
    retentionRule: "HOURS",
    retentionValue: 24,
    enabled: false,
    version: 1,
    approvedAt: null,
    updatedAt: "2026-09-18T00:00:00.000Z",
    label: "Public upload orphans",
  },
  {
    id: "recruitment-unsuccessful",
    retentionClass: "RECRUITMENT_UNSUCCESSFUL",
    retentionRule: "DAYS",
    retentionValue: 30,
    enabled: true,
    version: 1,
    approvedAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    label: "Unsuccessful recruitment files",
  },
  {
    id: "recruitment-hired",
    retentionClass: "RECRUITMENT_HIRED",
    retentionRule: "YEARS",
    retentionValue: 7,
    enabled: true,
    version: 1,
    approvedAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    label: "Hired recruitment files",
  },
  {
    id: "employee-record",
    retentionClass: "EMPLOYEE_RECORD",
    retentionRule: "YEARS",
    retentionValue: 10,
    enabled: true,
    version: 1,
    approvedAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T00:00:00.000Z",
    label: "Employee records",
  },
  {
    id: "infected-or-failed-scan",
    retentionClass: "INFECTED_OR_FAILED_SCAN",
    retentionRule: "HOURS",
    retentionValue: 48,
    enabled: false,
    version: 1,
    approvedAt: null,
    updatedAt: "2026-09-18T00:00:00.000Z",
    label: "Infected or failed scans",
  },
] as const;

describe("DocumentRetentionPage policy controls", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useQuery).mockReturnValue({
      data: policies,
      error: null,
      isLoading: false,
    } as never);
  });

  it.each(policies)("associates all controls for $label with distinct contextual labels", (policy) => {
    render(<DocumentRetentionPage />);

    const controlIdPrefix = `document-retention-${policy.retentionClass
      .toLowerCase()
      .replaceAll("_", "-")}`;
    const policyLabelId = `${controlIdPrefix}-label`;

    const controls = [
      {
        control: screen.getByRole("combobox", { name: `${policy.label} Rule` }),
        id: `${controlIdPrefix}-rule`,
        label: "Rule",
      },
      {
        control: screen.getByRole("spinbutton", { name: `${policy.label} Value` }),
        id: `${controlIdPrefix}-value`,
        label: "Value",
      },
      {
        control: screen.getByRole("switch", { name: `${policy.label} Enabled` }),
        id: `${controlIdPrefix}-enabled`,
        label: "Enabled",
      },
    ];

    for (const { control, id, label } of controls) {
      const labelId = `${id}-label`;

      expect(control).toHaveAccessibleName(`${policy.label} ${label}`);
      expect(control).toHaveAttribute("id", id);
      expect(control).toHaveAttribute("aria-labelledby", `${policyLabelId} ${labelId}`);
      expect(document.getElementById(labelId)).toHaveAttribute("for", id);
    }

    expect(
      screen.getByRole("button", { name: `Save ${policy.label}` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Approve ${policy.label}` }),
    ).toBeInTheDocument();
  });
});
