"use client";

import { useMemo, useState } from "react";
import { FilePlus2, Settings2 } from "lucide-react";
import Link from "next/link";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { SecureFileUploadField } from "@/components/file-upload/secure-file-upload-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import {
  useArchiveHrRequestType,
  useCreateHrRequest,
  useCreateHrRequestType,
  useHrRequestCommand,
  useHrRequests,
  useHrRequestTypes,
  useHrRequestWorkflowCandidates,
  useUpdateHrRequestType,
} from "../hooks";
import {
  actorLabel,
  createOperationId,
  displayDate,
  hasAllowedAction,
} from "../lib/allowed-actions";
import {
  businessReasonHint,
  isValidBusinessReason,
} from "../lib/business-reason";
import { HrOperationsApiService } from "../services/hr-operations-api.service";
import type {
  HrRequest,
  HrRequestAction,
  HrRequestType,
} from "../types";
import { HrOpsPathBanner } from "./hr-ops-path-banner";
import { MyHrRequestWorkspace } from "./my-hr-request-workspace";

type HrRequestWorkspaceMode = "mine" | "hr";

const actionLabel: Record<HrRequestAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  COMPLETE: "Complete",
  CANCEL: "Cancel",
};

export function HrRequestWorkspace({ mode }: { mode: HrRequestWorkspaceMode }) {
  if (mode === "mine") {
    return <MyHrRequestWorkspace />;
  }

  return <HrRequestAdminWorkspace mode={mode} />;
}

function HrRequestAdminWorkspace({ mode }: { mode: HrRequestWorkspaceMode }) {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<HrRequestType | null>(null);
  const [selectedAction, setSelectedAction] = useState<{
    request: HrRequest;
    action: HrRequestAction;
  } | null>(null);
  const requestsQuery = useHrRequests({
    status: status === "ALL" ? undefined : (status as HrRequest["status"]),
    keyword: keyword.trim() || undefined,
    page: 1,
    limit: 50,
  });
  const typesQuery = useHrRequestTypes();
  const archiveTypeMutation = useArchiveHrRequestType();
  const rows = requestsQuery.data?.items ?? [];
  const types = useMemo(
    () => (typesQuery.data?.items ?? []).filter((item) => item.isActive),
    [typesQuery.data?.items],
  );
  const collectionActions = requestsQuery.data?.allowedActions;
  const typeCollectionActions = typesQuery.data?.allowedActions;

  return (
    <WorkspaceShell>
      <HrOpsPathBanner
        current={mode === "mine" ? "my-requests" : "hr-queue"}
        note={
          mode === "mine"
            ? "You submit for yourself → your Manager Approves (My Workspace → Approvals) → HR Completes on this HR queue."
            : "New request = for the person logged in (their employee record). To practice the full path: cancel Arun’s row, log in as Rohan → My Workspace → HR requests → submit. Meera Approves → Arun Completes."
        }
      />
      <PageToolbar>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            className="max-w-sm"
            placeholder={mode === "mine" ? "Search my requests…" : "Search requests…"}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={requestsQuery.isFetching}
            onClick={() => void requestsQuery.refetch()}
          >
            {requestsQuery.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {hasAllowedAction(collectionActions, "CREATE") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <FilePlus2 className="mr-1 size-4" />
              New request
            </Button>
          ) : (
            <Button
              type="button"
              disabled
              title={
                mode === "mine"
                  ? "Your account must be linked to an active employee to submit HR requests."
                  : "You need HR request create permission."
              }
            >
              New request
            </Button>
          )}
          {mode === "hr" && hasAllowedAction(typeCollectionActions, "CREATE") ? (
            <Button variant="outline" onClick={() => setTypeDialogOpen(true)}>
              <Settings2 className="mr-1 size-4" />
              New request type
            </Button>
          ) : null}
        </div>
      </PageToolbar>

      {mode === "mine" ? (
        <AvailableRequestTypesPanel
          types={types}
          loading={typesQuery.isLoading}
          onRequest={() => setCreateOpen(true)}
          canCreate={hasAllowedAction(collectionActions, "CREATE")}
        />
      ) : null}

      {requestsQuery.error ? (
        <WorkspaceMessage
          message={getApiErrorMessage(requestsQuery.error, "Could not load HR requests.")}
        />
      ) : requestsQuery.isLoading ? (
        <WorkspaceMessage message="Loading HR requests…" />
      ) : rows.length === 0 ? (
        <WorkspaceMessage
          message={
            mode === "mine"
              ? "No HR requests are visible to you."
              : "No HR requests match the selected filters."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                {mode === "hr" ? <th className="px-4 py-3 font-medium">Employee</th> : null}
                <th className="px-4 py-3 font-medium">Request</th>
                <th className="px-4 py-3 font-medium">Attachment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Waiting on</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((request) => (
                <tr key={request.id} className="border-t">
                  {mode === "hr" ? (
                    <td className="px-4 py-3">{actorLabel(request.employee)}</td>
                  ) : null}
                  <td className="px-4 py-3">
                    <p className="font-medium">{request.requestType?.requestName ?? request.requestNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.requestNo}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <RequestAttachmentCell request={request} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge label={request.status} tone="neutral" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {request.status === "PENDING_APPROVAL"
                      ? request.approvalTransaction?.pendingApprover
                        ? `Waiting on ${actorLabel(request.approvalTransaction.pendingApprover)}`
                        : request.approvalTransaction?.currentStep
                          ? `Approval step ${request.approvalTransaction.currentStep}`
                          : "Waiting for approver"
                      : request.status === "APPROVED"
                        ? "HR to complete"
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {displayDate(request.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {(request.allowedActions ?? []).map((action) => (
                        <Button
                          key={action}
                          type="button"
                          size="sm"
                          variant={action === "REJECT" || action === "CANCEL" ? "outline" : "default"}
                          onClick={() => setSelectedAction({ request, action })}
                        >
                          {actionLabel[action]}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "hr" ? (
        <RequestTypeTable
          types={typesQuery.data?.items ?? []}
          loading={typesQuery.isLoading}
          error={typesQuery.error ? getApiErrorMessage(typesQuery.error, "Could not load request types.") : null}
          onEdit={(requestType) => {
            setEditingType(requestType);
            setTypeDialogOpen(true);
          }}
          onArchive={(requestType) => {
            void archiveTypeMutation
              .mutateAsync(requestType.id)
              .then(() => toast.success("Request type archived."))
              .catch((error) => toast.error(getApiErrorMessage(error, "Could not archive request type.")));
          }}
        />
      ) : null}

      <CreateRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        types={types}
        mode={mode}
      />
      <RequestTypeDialog
        key={typeDialogOpen ? editingType?.id ?? "new" : "closed"}
        open={typeDialogOpen}
        onOpenChange={(open) => {
          setTypeDialogOpen(open);
          if (!open) setEditingType(null);
        }}
        requestType={editingType}
      />
      <RequestActionDialog
        selected={selectedAction}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
      />
    </WorkspaceShell>
  );
}

function WorkspaceMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function RequestAttachmentCell({ request }: { request: HrRequest }) {
  const [loading, setLoading] = useState(false);
  const present = Boolean(
    request.attachment?.present ?? request.fileObjectId,
  );
  const fileName = request.attachment?.fileName;

  async function openAttachment() {
    setLoading(true);
    try {
      const grant =
        await HrOperationsApiService.createRequestAttachmentDownloadGrant(
          request.id,
        );
      window.open(grant.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not open attachment."));
    } finally {
      setLoading(false);
    }
  }

  if (!present) {
    return (
      <span className="text-muted-foreground text-xs">No attachment</span>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium">{fileName ?? "Attached file"}</p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => void openAttachment()}
      >
        {loading ? "Opening…" : "View file"}
      </Button>
    </div>
  );
}

function CreateRequestDialog({
  open,
  onOpenChange,
  types,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: HrRequestType[];
  mode: HrRequestWorkspaceMode;
}) {
  const createMutation = useCreateHrRequest();
  const [requestTypeId, setRequestTypeId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachmentUploadSessionId, setAttachmentUploadSessionId] = useState<
    string | undefined
  >();

  async function submit() {
    if (!requestTypeId) return;
    try {
      await createMutation.mutateAsync({
        requestTypeId,
        remarks: remarks.trim() || undefined,
        attachmentUploadSessionId,
        operationId: createOperationId(),
      });
      toast.success("HR request submitted.");
      setRequestTypeId("");
      setRemarks("");
      setAttachmentUploadSessionId(undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not submit HR request."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New HR request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            {mode === "mine" ? (
              <p>
                This request is <strong>for you</strong> (your employee record).
                After submit, your manager opens{" "}
                <strong>My Workspace → Approvals & clearance</strong> to Approve.
                Then HR Completes on the HR Requests queue.
              </p>
            ) : (
              <p>
                <strong>No employee picker</strong> — this always creates a
                request for <strong>whoever is logged in</strong> (right now: you
                as HR). The Employee column shows that person. For a normal test:
                submit as <strong>Rohan</strong> from My Workspace → HR requests,
                then Approve as <strong>Meera</strong>, then Complete as Arun.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hr-request-type">Request type</Label>
            <Select
              value={requestTypeId}
              onValueChange={setRequestTypeId}
              disabled={types.length === 0}
            >
              <SelectTrigger id="hr-request-type">
                <SelectValue
                  placeholder={
                    types.length === 0
                      ? "No active request types yet"
                      : "Select a request type"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.requestName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {types.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                HR must create an active request type first (HR Requests → New
                request type). You do not create the request as HR for the
                employee — the employee submits it here.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hr-request-remarks">Remarks</Label>
            <Textarea
              id="hr-request-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>
          <SecureFileUploadField
            label="Attachment (optional)"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            maxSizeMb={25}
            onSessionReady={(sessionId) =>
              setAttachmentUploadSessionId(sessionId)
            }
            createSession={HrOperationsApiService.createRequestUploadSession}
            finalizeSession={HrOperationsApiService.finalizeRequestUploadSession}
            pollSession={HrOperationsApiService.pollRequestUploadSession}
            disabled={createMutation.isPending}
          />
          <p className="text-muted-foreground text-xs">
            Optional. If you upload, Manager and HR can open it from the request
            row (View file). If you skip it, they see “No attachment”.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!requestTypeId || createMutation.isPending}
            onClick={() => void submit()}
          >
            {createMutation.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestActionDialog({
  selected,
  onOpenChange,
}: {
  selected: { request: HrRequest; action: HrRequestAction } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const commandMutation = useHrRequestCommand();
  const [reason, setReason] = useState("");
  const requiresReason =
    selected?.action === "REJECT" || selected?.action === "CANCEL";
  const reasonOk = !requiresReason || isValidBusinessReason(reason);

  async function submit() {
    if (!selected || !reasonOk) return;
    try {
      await commandMutation.mutateAsync({
        id: selected.request.id,
        action: selected.action.toLowerCase() as
          | "approve"
          | "reject"
          | "complete"
          | "cancel",
        input: {
          expectedVersion: selected.request.version,
          operationId: createOperationId(),
          reason: reason.trim() || undefined,
        },
      });
      const successLabel: Record<HrRequestAction, string> = {
        APPROVE: "Request approved.",
        REJECT: "Request rejected.",
        COMPLETE: "Request completed.",
        CANCEL: "Request cancelled.",
      };
      toast.success(successLabel[selected.action]);
      setReason("");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update HR request."));
    }
  }

  return (
    <Dialog open={Boolean(selected)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selected ? actionLabel[selected.action] : "Request action"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {selected?.request.requestNo}
            {selected?.action === "COMPLETE"
              ? " · Completing marks fulfilment done after approval."
              : null}
          </p>
          {selected ? (
            <div className="rounded-lg border px-3 py-2 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                Attachment
              </p>
              <div className="mt-1">
                <RequestAttachmentCell request={selected.request} />
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="hr-request-action-reason">
              {requiresReason
                ? "Rejection / cancellation reason (required)"
                : "Remarks (optional)"}
            </Label>
            <Textarea
              id="hr-request-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {businessReasonHint(requiresReason)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !selected || commandMutation.isPending || !reasonOk
            }
            onClick={() => void submit()}
          >
            {commandMutation.isPending
              ? "Saving…"
              : selected
                ? actionLabel[selected.action]
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AvailableRequestTypesPanel({
  types,
  loading,
  onRequest,
  canCreate,
}: {
  types: HrRequestType[];
  loading: boolean;
  onRequest: () => void;
  canCreate: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">What you can request</p>
          <p className="text-muted-foreground mt-1 text-xs">
            HR publishes these for the whole company. Anyone who needs one
            submits for themselves — there is no “assigned employee.”
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-muted-foreground mt-3 text-xs">Loading types…</p>
      ) : types.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-xs">
          No request types yet. Ask HR to create one (e.g. Employment letter).
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <div>
                <p className="font-medium">{type.requestName}</p>
                <p className="text-muted-foreground text-xs">
                  {type.requestCode}
                  {type.requiresApproval === false
                    ? " · No manager approval"
                    : " · Manager approves, then HR completes"}
                </p>
              </div>
              {canCreate ? (
                <Button size="sm" variant="outline" onClick={onRequest}>
                  Request this
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestTypeTable({
  types,
  loading,
  error,
  onEdit,
  onArchive,
}: {
  types: HrRequestType[];
  loading: boolean;
  error: string | null;
  onEdit: (type: HrRequestType) => void;
  onArchive: (type: HrRequestType) => void;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">Request type configuration (setup)</h2>
        <p className="text-sm text-muted-foreground">
          Company catalog — every linked employee can pick these on My Workspace
          → HR requests. You do not assign a type to one person; whoever needs
          the letter/document submits for themselves.
        </p>
      </div>
      {loading || error || types.length === 0 ? (
        <WorkspaceMessage message={error ?? (loading ? "Loading request types…" : "No request types configured.")} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Approval path</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
            <tbody>{types.map((type) => <tr key={type.id} className="border-t"><td className="px-4 py-3"><p className="font-medium">{type.requestName}</p><p className="text-xs text-muted-foreground">{type.requestCode}</p></td><td className="px-4 py-3 text-muted-foreground">{type.workflow ? (type.workflow.workflowName || type.workflow.workflowCode) : "Manager Approves (default)"}</td><td className="px-4 py-3"><StatusBadge label={type.isActive ? "ACTIVE" : "ARCHIVED"} tone="neutral" /></td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{hasAllowedAction(type.allowedActions, "UPDATE") ? <Button size="sm" variant="outline" onClick={() => onEdit(type)}>Edit</Button> : null}{hasAllowedAction(type.allowedActions, "ARCHIVE") ? <Button size="sm" variant="outline" onClick={() => onArchive(type)}>Archive</Button> : null}</div></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RequestTypeDialog({
  open,
  onOpenChange,
  requestType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestType: HrRequestType | null;
}) {
  const createMutation = useCreateHrRequestType();
  const updateMutation = useUpdateHrRequestType();
  const workflowCandidates = useHrRequestWorkflowCandidates();
  const [name, setName] = useState(requestType?.requestName ?? "");
  const [requiresApproval, setRequiresApproval] = useState(
    requestType?.requiresApproval ?? true,
  );
  const [workflowId, setWorkflowId] = useState(requestType?.workflowId ?? "");
  const isEditing = Boolean(requestType);
  const hrWorkflows = workflowCandidates.data ?? [];
  const selectedWorkflowId =
    workflowId || (hrWorkflows.length === 1 ? hrWorkflows[0]?.id ?? "" : "");

  async function submit() {
    if (!name.trim()) return;
    if (requiresApproval && !selectedWorkflowId) {
      toast.error(
        "Configure an active Company HR Request workflow before saving this request type.",
      );
      return;
    }
    try {
      if (requestType) {
        await updateMutation.mutateAsync({
          id: requestType.id,
          input: {
            requestName: name.trim(),
            requiresApproval,
            workflowId: requiresApproval ? selectedWorkflowId : undefined,
          },
        });
      } else {
        await createMutation.mutateAsync({
            requestName: name.trim(),
            requiresApproval,
            workflowId: requiresApproval ? selectedWorkflowId : undefined,
        });
      }
      toast.success(`Request type ${isEditing ? "updated" : "created"}.`);
      setName("");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not save request type."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit request type" : "New request type"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {isEditing ? (
            <div className="space-y-2">
              <Label>Code</Label>
              <p className="rounded-lg border bg-muted/40 px-3 py-2 font-mono text-sm">
                {requestType?.requestCode}
              </p>
              <p className="text-muted-foreground text-xs">
                Code was set when created and cannot be changed here.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              Code is created automatically on Save (e.g. HRT-00001). You only
              need a name.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="request-type-name">Name</Label>
            <Input
              id="request-type-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Employment letter"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="request-type-requires-approval">
                Requires approval
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, someone must Approve before HR can Complete.
              </p>
            </div>
            <Switch
              id="request-type-requires-approval"
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
          </div>
          {requiresApproval ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Who approves?</Label>
              <p className="text-muted-foreground text-xs">
                Choose the active Company workflow for this request type. Leave,
                overtime, and attendance use their own workflow screens.
              </p>
              {workflowCandidates.isLoading ? (
                <p className="text-xs text-muted-foreground">
                  Checking approval path…
                </p>
              ) : hrWorkflows.length === 0 ? (
                <p className="text-sm text-destructive">
                  Workflow not configured. <Link href="/administration/approval-workflows" className="underline">Open Setup → Approval workflows</Link> to create an active Company workflow with approval steps, then return here to select it.
                </p>
              ) : (
                <Select value={selectedWorkflowId} onValueChange={setWorkflowId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select approval workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {hrWorkflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.workflowName || workflow.workflowCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              !name.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            onClick={() => void submit()}
          >
            {createMutation.isPending || updateMutation.isPending
              ? "Saving…"
              : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
