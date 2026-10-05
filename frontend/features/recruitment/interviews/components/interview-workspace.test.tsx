import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewWorkspace } from "./interview-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/forms", () => ({
  LookupSelect: ({
    id,
    placeholder,
  }: {
    id?: string;
    placeholder?: string;
  }) => (
    <button id={id} type="button">
      {placeholder}
    </button>
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({
    children,
    id,
  }: {
    children: React.ReactNode;
    id?: string;
  }) => (
    <button id={id} type="button">
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/features/lookups/hooks/use-lookups", () => ({
  useBranches: vi.fn(),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ hasPermission: () => false }),
}));

vi.mock("../../openings/hooks/use-job-openings", () => ({
  useJobOpenings: vi.fn(),
}));

vi.mock("../dialogs/schedule-interview-dialog", () => ({
  ScheduleInterviewDialog: () => null,
}));

vi.mock("../hooks/use-interviews", () => ({
  useInterviewSessions: vi.fn(),
}));

vi.mock("./interview-table", () => ({
  InterviewTable: () => null,
}));

import { useBranches } from "@/features/lookups/hooks/use-lookups";

import { useJobOpenings } from "../../openings/hooks/use-job-openings";
import { useInterviewSessions } from "../hooks/use-interviews";

describe("InterviewWorkspace", () => {
  beforeEach(() => {
    vi.mocked(useBranches).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useJobOpenings).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useInterviewSessions).mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it("associates visible labels with the scheduled-date filters", () => {
    render(<InterviewWorkspace />);

    expect(screen.getByLabelText("Scheduled from")).toHaveAttribute(
      "type",
      "date",
    );
    expect(screen.getByLabelText("Scheduled to")).toHaveAttribute(
      "type",
      "date",
    );
  });

  it("gives every interview toolbar filter an accessible name", () => {
    render(<InterviewWorkspace />);

    expect(screen.getByLabelText("Search interviews")).toHaveAttribute(
      "placeholder",
      "Search candidate, opening, round…",
    );
    expect(screen.getByLabelText("Interview status")).toHaveRole("button");
    expect(screen.getByLabelText("Job opening")).toHaveRole("button");
    expect(screen.getByLabelText("Branch")).toHaveRole("button");
  });
});
