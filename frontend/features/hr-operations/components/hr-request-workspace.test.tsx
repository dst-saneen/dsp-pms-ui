import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HrRequestWorkspace } from "./hr-request-workspace";

const authState = vi.hoisted(() => ({
  user: { employeeId: "employee-1" } as { employeeId?: string } | null,
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/file-upload/secure-file-upload-field", () => ({
  SecureFileUploadField: ({
    onSessionReady,
    onStateChange,
  }: {
    onSessionReady: (sessionId: string, fileObjectId: string) => void;
    onStateChange?: (state: string) => void;
  }) => (
    <div data-testid="secure-upload">
      <button type="button" onClick={() => onStateChange?.("uploading")}>Start upload</button>
      <button
        type="button"
        onClick={() => {
          onSessionReady("session-1", "file-1");
          onStateChange?.("clean");
        }}
      >
        Complete upload
      </button>
    </div>
  ),
}));

vi.mock("../hooks", () => ({
  useAllHrRequests: vi.fn(),
  useArchiveHrRequestType: vi.fn(),
  useHrRequests: vi.fn(),
  useHrRequestTypes: vi.fn(),
  useHrRequestWorkflowCandidates: vi.fn(),
  useCreateHrRequest: vi.fn(),
  useHrRequestCommand: vi.fn(),
  useCreateHrRequestType: vi.fn(),
  useUpdateHrRequestType: vi.fn(),
}));

import {
  useAllHrRequests,
  useArchiveHrRequestType,
  useCreateHrRequest,
  useCreateHrRequestType,
  useHrRequestCommand,
  useHrRequestTypes,
  useHrRequestWorkflowCandidates,
  useHrRequests,
  useUpdateHrRequestType,
} from "../hooks";

const queryState = {
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
};

describe("HrRequestWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    authState.user = { employeeId: "employee-1" };
    vi.mocked(useHrRequestTypes).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 50, allowedActions: [] },
    } as never);
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 100, allowedActions: [] },
    } as never);
    vi.mocked(useHrRequestWorkflowCandidates).mockReturnValue({
      ...queryState,
      data: [],
    } as never);
    vi.mocked(useCreateHrRequest).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useHrRequestCommand).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useCreateHrRequestType).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useUpdateHrRequestType).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useArchiveHrRequestType).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  });

  it("renders only employee-appropriate row actions supplied by the API", () => {
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: {
        items: [{
          id: "request-1", companyId: "company-1", employeeId: "employee-1",
          requestTypeId: "type-1", requestNo: "HR-0001", status: "PENDING_APPROVAL",
          version: 1, createdAt: "2026-09-01T00:00:00.000Z",
          requestType: { id: "type-1", requestCode: "LETTER", requestName: "Employment letter", isActive: true },
          allowedActions: ["APPROVE", "CANCEL"],
        }],
        total: 1, page: 1, limit: 50, allowedActions: ["CREATE"],
      },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    expect(screen.getByRole("button", { name: "New request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("shows a linked-employee state without exposing request actions", () => {
    authState.user = { employeeId: undefined };

    render(<HrRequestWorkspace mode="mine" />);

    expect(screen.getByRole("heading", { name: "Employee profile not linked" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "New request" })).not.toBeInTheDocument();
    expect(useAllHrRequests).toHaveBeenCalledWith(undefined, false);
  });

  it("explains why create is unavailable without inferring permission", () => {
    vi.mocked(useHrRequestTypes).mockReturnValue({
      ...queryState,
      data: {
        items: [{
          id: "type-1", requestCode: "LETTER", requestName: "Employment letter",
          requiresApproval: true, isActive: true,
        }],
        total: 1, page: 1, limit: 50, allowedActions: [],
      },
    } as never);
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 50, allowedActions: [] },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    const createButton = screen.getByRole("button", { name: "New request" });
    expect(createButton).toBeDisabled();
    expect(createButton).toHaveAttribute(
      "title",
      "You do not have permission to submit HR requests.",
    );
  });

  it("scopes the employee workspace to the authenticated employee", () => {
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 50, allowedActions: [] },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    expect(useAllHrRequests).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: "employee-1" }),
      true,
    );
    expect(useAllHrRequests).not.toHaveBeenCalledWith(
      expect.objectContaining({ scope: "mine" }),
      expect.anything(),
    );
  });

  it("presents employee requests as a service catalogue with active tracking and history", () => {
    vi.mocked(useHrRequestTypes).mockReturnValue({
      ...queryState,
      data: {
        items: [
          {
            id: "type-1",
            requestCode: "EMP-LETTER",
            requestName: "Employment letter",
            requiresApproval: true,
            isActive: true,
          },
          {
            id: "type-2",
            requestCode: "ADDRESS-PROOF",
            requestName: "Address proof letter",
            requiresApproval: false,
            isActive: true,
          },
        ],
        total: 2,
        page: 1,
        limit: 50,
        allowedActions: [],
      },
    } as never);
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: {
        items: [
          {
            id: "request-active",
            companyId: "company-1",
            employeeId: "employee-1",
            requestTypeId: "type-1",
            requestNo: "HR-0001",
            status: "PENDING_APPROVAL",
            version: 1,
            createdAt: "2026-09-20T00:00:00.000Z",
            requestType: {
              id: "type-1",
              requestCode: "EMP-LETTER",
              requestName: "Employment letter",
              requiresApproval: true,
              isActive: true,
            },
            approvalTransaction: {
              currentStep: 1,
              status: "PENDING",
              pendingApprover: { id: "manager-1", displayName: "Meera Shah" },
            },
            allowedActions: ["CANCEL"],
          },
          {
            id: "request-complete",
            companyId: "company-1",
            employeeId: "employee-1",
            requestTypeId: "type-2",
            requestNo: "HR-0002",
            status: "COMPLETED",
            version: 2,
            createdAt: "2026-08-20T00:00:00.000Z",
            completedAt: "2026-08-22T00:00:00.000Z",
            requestType: {
              id: "type-2",
              requestCode: "ADDRESS-PROOF",
              requestName: "Address proof letter",
              requiresApproval: false,
              isActive: true,
            },
            allowedActions: [],
          },
        ],
        total: 2,
        page: 1,
        limit: 50,
        allowedActions: ["CREATE"],
      },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    expect(screen.getByRole("heading", { name: "What do you need?" })).toBeVisible();
    expect(screen.getByText("Approval required")).toBeVisible();
    expect(screen.getByText("No approval required")).toBeVisible();
    expect(screen.getByRole("heading", { name: "My active requests" })).toBeVisible();
    expect(screen.getByText("HR-0001")).toBeVisible();
    expect(screen.getByText("Waiting on Meera Shah")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Request history" })).toBeVisible();
    expect(screen.getAllByText("HR-0002")).not.toHaveLength(0);
    expect(screen.queryByText(/You submit for yourself/)).not.toBeInTheDocument();
  });

  it("reviews a preselected HR service before submission", () => {
    vi.mocked(useHrRequestTypes).mockReturnValue({
      ...queryState,
      data: {
        items: [
          {
            id: "type-1",
            requestCode: "EMP-LETTER",
            requestName: "Employment letter",
            requiresApproval: true,
            isActive: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
        allowedActions: [],
      },
    } as never);
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        allowedActions: ["CREATE"],
      },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    fireEvent.click(screen.getByRole("button", { name: "Request Employment letter" }));
    expect(screen.getByRole("heading", { name: "Request details" })).toBeVisible();
    expect(screen.queryByLabelText("HR request progress")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Remarks"), {
      target: { value: "Please issue this for my bank." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));

    expect(screen.getByRole("heading", { name: "Review & submit" })).toBeVisible();
    expect(screen.getAllByText("Please issue this for my bank.")[1]).toBeVisible();
    expect(screen.getByRole("button", { name: "Submit request" })).toBeVisible();
  });

  it("waits for an attachment, keeps it mounted, and submits its clean session", async () => {
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useCreateHrRequest).mockReturnValue({
      mutateAsync,
      isPending: false,
    } as never);
    vi.mocked(useHrRequestTypes).mockReturnValue({
      ...queryState,
      data: {
        items: [{
          id: "type-1", requestCode: "EMP-LETTER", requestName: "Employment letter",
          requiresApproval: true, isActive: true,
        }],
        total: 1, page: 1, limit: 50, allowedActions: [],
      },
    } as never);
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 100, allowedActions: ["CREATE"] },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    fireEvent.click(screen.getByRole("button", { name: "Request Employment letter" }));
    fireEvent.click(screen.getByRole("button", { name: "Start upload" }));
    expect(screen.getByRole("button", { name: /Preparing attachment/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Complete upload" }));
    fireEvent.click(screen.getByRole("button", { name: "Review request" }));

    expect(screen.getByText("Attachment ready")).toBeVisible();
    expect(screen.getByTestId("secure-upload")).toBeInTheDocument();
    expect(screen.getByTestId("secure-upload")).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          requestTypeId: "type-1",
          attachmentUploadSessionId: "session-1",
        }),
      );
    });
  });

  it("derives approval progress from the request transaction snapshot", () => {
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: {
        items: [{
          id: "request-no-approval", companyId: "company-1", employeeId: "employee-1",
          requestTypeId: "type-1", requestNo: "HR-0003", status: "APPROVED",
          version: 1, createdAt: "2026-09-20T00:00:00.000Z",
          requestType: {
            id: "type-1", requestCode: "LETTER", requestName: "Employment letter",
            requiresApproval: true, isActive: true,
          },
          approvalTransaction: null,
          allowedActions: [],
        }],
        total: 1, page: 1, limit: 50, allowedActions: ["CREATE"],
      },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    const progress = screen.getByLabelText("Progress for HR-0003");
    expect(within(progress).queryByText("Approval")).not.toBeInTheDocument();
    expect(within(progress).getByText("HR completion")).toBeVisible();
  });

  it("clears a command reason when the dialog closes", () => {
    vi.mocked(useAllHrRequests).mockReturnValue({
      ...queryState,
      data: {
        items: ["1", "2"].map((suffix) => ({
          id: `request-${suffix}`, companyId: "company-1", employeeId: "employee-1",
          requestTypeId: "type-1", requestNo: `HR-000${suffix}`,
          status: "PENDING_APPROVAL" as const, version: 1,
          createdAt: "2026-09-20T00:00:00.000Z",
          requestType: { id: "type-1", requestCode: "LETTER", requestName: "Employment letter", isActive: true },
          approvalTransaction: { currentStep: 1, status: "PENDING" },
          allowedActions: ["CANCEL" as const],
        })),
        total: 2, page: 1, limit: 50, allowedActions: ["CREATE"],
      },
    } as never);

    render(<HrRequestWorkspace mode="mine" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    fireEvent.change(screen.getByLabelText("Reason (required)"), {
      target: { value: "No longer required" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[1]);

    expect(screen.getByLabelText("Reason (required)")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("keeps the HR administration workspace unchanged", () => {
    vi.mocked(useHrRequests).mockReturnValue({
      ...queryState,
      data: { items: [], total: 0, page: 1, limit: 50, allowedActions: [] },
    } as never);

    render(<HrRequestWorkspace mode="hr" />);

    expect(screen.getByText("HR operations path")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Request type configuration (setup)" }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "What do you need?" })).not.toBeInTheDocument();
  });
});
