"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  FileText,
  FilePlus2,
  Paperclip,
  PlusCircle,
  RefreshCw,
  Search,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import {
  SecureFileUploadField,
  type UploadClientState,
} from "@/components/file-upload/secure-file-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useAllHrRequests,
  useCreateHrRequest,
  useHrRequestCommand,
  useHrRequestTypes,
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
  HrRequestStatus,
  HrRequestType,
} from "../types";

const ACTIVE_STATUSES = new Set<HrRequestStatus>([
  "PENDING_APPROVAL",
  "APPROVED",
]);

const HISTORY_FILTERS: Array<{
  value: "ALL" | "COMPLETED" | "REJECTED" | "CANCELLED";
  label: string;
}> = [
  { value: "ALL", label: "All" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_PRESENTATION: Record<
  HrRequestStatus,
  { label: string; tone: StatusTone }
> = {
  PENDING_APPROVAL: { label: "Pending approval", tone: "information" },
  APPROVED: { label: "Approved", tone: "progress" },
  REJECTED: { label: "Rejected", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

const ACTION_LABELS: Record<HrRequestAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  COMPLETE: "Complete",
  CANCEL: "Cancel",
};

function waitingOn(request: HrRequest) {
  if (request.status === "PENDING_APPROVAL") {
    if (request.approvalTransaction?.pendingApprover) {
      return `Waiting on ${actorLabel(request.approvalTransaction.pendingApprover)}`;
    }
    if (request.approvalTransaction?.currentStep) {
      return `Waiting on approval step ${request.approvalTransaction.currentStep}`;
    }
    return "Waiting for approval";
  }

  if (request.status === "APPROVED") {
    return "Waiting on HR completion";
  }

  return null;
}

export function MyHrRequestWorkspace() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const linked = Boolean(employeeId);
  const [createOpen, setCreateOpen] = useState(false);
  const [preselectedTypeId, setPreselectedTypeId] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<HrRequest | null>(null);
  const [selectedAction, setSelectedAction] = useState<{
    request: HrRequest;
    action: HrRequestAction;
  } | null>(null);
  const [keyword, setKeyword] = useState("");
  const [historyStatus, setHistoryStatus] = useState<
    "ALL" | "COMPLETED" | "REJECTED" | "CANCELLED"
  >("ALL");

  const requestsQuery = useAllHrRequests(
    employeeId ? { employeeId } : undefined,
    linked,
  );
  const typesQuery = useHrRequestTypes(linked);

  const requests = requestsQuery.data?.items;
  const activeTypes = useMemo(
    () => (typesQuery.data?.items ?? []).filter((item) => item.isActive),
    [typesQuery.data?.items],
  );
  const activeRequests = useMemo(
    () => (requests ?? []).filter((request) => ACTIVE_STATUSES.has(request.status)),
    [requests],
  );
  const historyRequests = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return (requests ?? []).filter((request) => {
      if (ACTIVE_STATUSES.has(request.status)) return false;
      if (historyStatus !== "ALL" && request.status !== historyStatus) return false;
      if (!normalizedKeyword) return true;

      return [
        request.requestType?.requestName,
        request.requestType?.requestCode,
        request.requestNo,
      ].some((value) => value?.toLowerCase().includes(normalizedKeyword));
    });
  }, [historyStatus, keyword, requests]);

  const canCreate = hasAllowedAction(
    requestsQuery.data?.allowedActions,
    "CREATE",
  );
  const canOpenCreate =
    linked &&
    canCreate &&
    !typesQuery.isLoading &&
    !typesQuery.error &&
    activeTypes.length > 0;
  const createUnavailableReason = !linked
    ? "Your account must be linked to an active employee to submit HR requests."
    : requestsQuery.isLoading
      ? "Checking whether HR requests are available."
      : requestsQuery.error
        ? "Could not verify whether HR requests are available."
        : typesQuery.isLoading
          ? "Loading the available HR services."
          : typesQuery.error
            ? "Could not load the available HR services."
            : activeTypes.length === 0
              ? "HR has not published any request types yet."
              : "You do not have permission to submit HR requests.";

  if (!linked) {
    return (
      <WorkspaceShell>
        <PageHeader
          title="My HR requests"
          description="Request documents or support from HR and track their progress."
        />
        <Card className="py-0 shadow-none">
          <CardContent className="px-4 py-10 md:px-5">
            <EmptyState
              icon={UserRoundX}
              title="Employee profile not linked"
              description="HR requests become available after your user account is linked to an employee profile."
            />
          </CardContent>
        </Card>
      </WorkspaceShell>
    );
  }

  const openCreate = (requestTypeId = "") => {
    setPreselectedTypeId(requestTypeId);
    setCreateOpen(true);
  };

  return (
    <WorkspaceShell>
      <PageHeader
        title="My HR requests"
        description="Request documents or support from HR and track their progress."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={requestsQuery.isFetching || typesQuery.isFetching}
              onClick={() => {
                void Promise.all([requestsQuery.refetch(), typesQuery.refetch()]);
              }}
            >
              <RefreshCw
                data-icon="inline-start"
                className={
                  requestsQuery.isFetching || typesQuery.isFetching
                    ? "animate-spin"
                    : undefined
                }
              />
              Refresh
            </Button>
            <Button
              type="button"
              disabled={!canOpenCreate}
              title={canOpenCreate ? undefined : createUnavailableReason}
              onClick={() => openCreate()}
            >
              <PlusCircle data-icon="inline-start" />
              New request
            </Button>
          </>
        }
      />

      <RequestServiceCatalogue
        types={activeTypes}
        loading={typesQuery.isLoading}
        error={typesQuery.error}
        canCreate={canOpenCreate}
        onRequest={openCreate}
        onRetry={() => {
          void typesQuery.refetch();
        }}
      />

      <ActiveRequests
        requests={activeRequests}
        loading={requestsQuery.isLoading}
        error={requestsQuery.error}
        onView={setSelectedRequest}
        onAction={(request, action) => setSelectedAction({ request, action })}
      />

      <RequestHistory
        requests={historyRequests}
        loading={requestsQuery.isLoading}
        error={requestsQuery.error}
        keyword={keyword}
        onKeywordChange={setKeyword}
        status={historyStatus}
        onStatusChange={setHistoryStatus}
        onView={setSelectedRequest}
      />

      <CreateHrRequestDialog
        key={createOpen ? preselectedTypeId || "new" : "closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        types={activeTypes}
        initialRequestTypeId={preselectedTypeId}
      />
      <RequestDetailsSheet
        request={selectedRequest}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null);
        }}
      />
      <RequestCommandDialog
        selected={selectedAction}
        onOpenChange={(open) => {
          if (!open) setSelectedAction(null);
        }}
      />
    </WorkspaceShell>
  );
}

function RequestServiceCatalogue({
  types,
  loading,
  error,
  canCreate,
  onRequest,
  onRetry,
}: {
  types: HrRequestType[];
  loading: boolean;
  error: unknown;
  canCreate: boolean;
  onRequest: (requestTypeId: string) => void;
  onRetry: () => void;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="px-4 py-4 md:px-5">
        <CardTitle role="heading" aria-level={2} className="text-lg">
          What do you need?
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Choose an available HR service to start a request.
        </p>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-5 md:pb-5">
        {loading ? (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
            }}
          >
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="bg-muted h-28 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={FilePlus2}
            title="Could not load HR services"
            description={getApiErrorMessage(error, "We could not load the available request types.")}
            actionLabel="Retry services"
            onAction={onRetry}
          />
        ) : types.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="No HR services available"
            description="HR has not published any request types yet."
          />
        ) : (
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
            }}
          >
            {types.map((type, index) => (
              <ServiceCard
                key={type.id}
                type={type}
                index={index}
                canCreate={canCreate}
                onRequest={onRequest}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const serviceIconClasses = [
  "bg-blue-50 text-blue-600",
  "bg-emerald-50 text-emerald-600",
  "bg-violet-50 text-violet-600",
  "bg-amber-50 text-amber-700",
];

function ServiceCard({
  type,
  index,
  canCreate,
  onRequest,
}: {
  type: HrRequestType;
  index: number;
  canCreate: boolean;
  onRequest: (requestTypeId: string) => void;
}) {
  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border p-4">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            serviceIconClasses[index % serviceIconClasses.length],
          )}
        >
          <FileText className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="break-words font-medium leading-5">
            {type.requestName}
          </h3>
          <p className="text-muted-foreground mt-1 break-words text-xs">
            {type.requestCode}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            type.requiresApproval === false
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700",
          )}
        >
          {type.requiresApproval === false ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <Clock3 className="size-3.5" />
          )}
          {type.requiresApproval === false
            ? "No approval required"
            : "Approval required"}
        </span>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label={`Request ${type.requestName}`}
            onClick={() => onRequest(type.id)}
          >
            Request
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function ActiveRequests({
  requests,
  loading,
  error,
  onView,
  onAction,
}: {
  requests: HrRequest[];
  loading: boolean;
  error: unknown;
  onView: (request: HrRequest) => void;
  onAction: (request: HrRequest, action: HrRequestAction) => void;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="border-b px-4 py-4 md:px-5">
        <CardTitle role="heading" aria-level={2} className="text-lg">
          My active requests
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          Track the progress of your current requests.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1].map((item) => (
              <div key={item} className="bg-muted h-24 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="p-5">
            <EmptyState
              icon={Clock3}
              title="Could not load active requests"
              description={getApiErrorMessage(error, "We could not load your HR requests.")}
            />
          </div>
        ) : requests.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CheckCircle2}
              title="No active requests"
              description="You have no HR requests waiting for approval or completion."
            />
          </div>
        ) : (
          <div className="divide-y">
            {requests.map((request) => (
              <ActiveRequestRow
                key={request.id}
                request={request}
                onView={onView}
                onAction={onAction}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveRequestRow({
  request,
  onView,
  onAction,
}: {
  request: HrRequest;
  onView: (request: HrRequest) => void;
  onAction: (request: HrRequest, action: HrRequestAction) => void;
}) {
  const presentation = STATUS_PRESENTATION[request.status];

  return (
    <article className="grid items-center gap-5 px-4 py-4 xl:grid-cols-[minmax(14rem,0.8fr)_minmax(26rem,1.4fr)_auto] md:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <FileText className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">
            {request.requestType?.requestName ?? "HR request"}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">{request.requestNo}</p>
          <p className="text-muted-foreground mt-2 text-xs">
            Submitted {displayDate(request.requestDate ?? request.createdAt)}
          </p>
          {request.attachment?.present ?? request.fileObjectId ? (
            <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
              <Paperclip className="size-3.5" />
              Attachment available
            </span>
          ) : null}
        </div>
      </div>

      <RequestProgress request={request} />

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <div className="mr-1 space-y-1 lg:text-right">
          <StatusBadge label={presentation.label} tone={presentation.tone} />
          {waitingOn(request) ? (
            <p className="text-muted-foreground text-xs">{waitingOn(request)}</p>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onView(request)}>
          View
        </Button>
        {(request.allowedActions ?? [])
          .filter((action) => action === "CANCEL")
          .map((action) => (
          <Button
            key={action}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAction(request, action)}
          >
            {ACTION_LABELS[action]}
          </Button>
          ))}
      </div>
    </article>
  );
}

function RequestProgress({ request }: { request: HrRequest }) {
  const needsApproval = Boolean(request.approvalTransaction);
  const stages = needsApproval
    ? [
        {
          key: "submitted",
          label: "Submitted",
          detail: displayDate(request.requestDate ?? request.createdAt),
        },
        {
          key: "approval",
          label: "Approval",
          detail: request.approvedAt
            ? `Approved ${displayDate(request.approvedAt)}`
            : null,
        },
        { key: "completion", label: "HR completion", detail: null },
      ]
    : [
        {
          key: "submitted",
          label: "Submitted",
          detail: displayDate(request.requestDate ?? request.createdAt),
        },
        { key: "completion", label: "HR completion", detail: null },
      ];
  const currentIndex = request.status === "PENDING_APPROVAL" ? 1 : stages.length - 1;

  return (
    <ol className="flex min-w-0 items-start" aria-label={`Progress for ${request.requestNo}`}>
      {stages.map((stage, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;

        return (
          <li
            key={stage.key}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={current ? "step" : undefined}
          >
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-3 right-1/2 h-0.5 w-full",
                  complete || current ? "bg-blue-500" : "bg-muted",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-card",
                complete
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : current
                    ? "border-blue-500 text-blue-600"
                    : "border-slate-300 text-slate-400",
              )}
            >
              {complete ? <Check className="size-3.5" /> : <Circle className="size-2.5 fill-current" />}
            </span>
            <span className="mt-2 text-xs font-medium">
              <span className="sr-only">
                {complete ? "Completed" : current ? "Current" : "Upcoming"}:{" "}
              </span>
              {stage.label}
            </span>
            {current ? (
              <span className="text-muted-foreground mt-0.5 text-xs">
                {request.status === "PENDING_APPROVAL"
                  ? "Waiting for approval"
                  : "Waiting on HR completion"}
              </span>
            ) : stage.detail ? (
              <span className="text-muted-foreground mt-0.5 text-xs">
                {stage.detail}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function RequestHistory({
  requests,
  loading,
  error,
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  onView,
}: {
  requests: HrRequest[];
  loading: boolean;
  error: unknown;
  keyword: string;
  onKeywordChange: (value: string) => void;
  status: "ALL" | "COMPLETED" | "REJECTED" | "CANCELLED";
  onStatusChange: (value: "ALL" | "COMPLETED" | "REJECTED" | "CANCELLED") => void;
  onView: (request: HrRequest) => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="border-b px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle role="heading" aria-level={2} className="text-lg">
              Request history
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              View your past requests and their status.
            </p>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-80">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={keyword}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder="Search by type or request number..."
                aria-label="Search request history"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Request history filters">
              {HISTORY_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={status === filter.value ? "secondary" : "outline"}
                  className={
                    status === filter.value
                      ? "border-primary/15 bg-primary-soft text-primary"
                      : undefined
                  }
                  aria-pressed={status === filter.value}
                  onClick={() => onStatusChange(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      {loading ? (
        <CardContent className="space-y-3 py-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="bg-muted h-11 animate-pulse rounded-lg" />
          ))}
        </CardContent>
      ) : error ? (
        <CardContent className="py-8">
          <EmptyState
            icon={FileText}
            title="Could not load request history"
            description={getApiErrorMessage(error, "We could not load your HR requests.")}
          />
        </CardContent>
      ) : requests.length === 0 ? (
        <CardContent className="py-10">
          <EmptyState
            icon={FileText}
            title="No request history"
            description="Completed, rejected, and cancelled requests will appear here."
          />
        </CardContent>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table aria-label="HR request history">
              <TableHeader>
                <TableRow>
                  <TableHead>Request type</TableHead>
                  <TableHead>Request number</TableHead>
                  <TableHead>Submitted date</TableHead>
                  <TableHead>Completed date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attachment</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const presentation = STATUS_PRESENTATION[request.status];
                  return (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        {request.requestType?.requestName ?? "HR request"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{request.requestNo}</TableCell>
                      <TableCell>{displayDate(request.requestDate ?? request.createdAt)}</TableCell>
                      <TableCell>
                        {request.completedAt ? displayDate(request.completedAt) : "-"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={presentation.label} tone={presentation.tone} />
                      </TableCell>
                      <TableCell>
                        {request.attachment?.present ?? request.fileObjectId ? (
                          <Paperclip className="text-muted-foreground size-4" aria-label="Attachment available" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => onView(request)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y md:hidden" aria-label="HR request history mobile">
            {requests.map((request) => {
              const presentation = STATUS_PRESENTATION[request.status];
              return (
                <article key={request.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {request.requestType?.requestName ?? "HR request"}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{request.requestNo}</p>
                    </div>
                    <StatusBadge label={presentation.label} tone={presentation.tone} />
                  </div>
                  <div className="text-muted-foreground flex items-end justify-between gap-3 text-xs">
                    <div>
                      <p>Submitted {displayDate(request.requestDate ?? request.createdAt)}</p>
                      {request.completedAt ? (
                        <p className="mt-1">Completed {displayDate(request.completedAt)}</p>
                      ) : null}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => onView(request)}>
                      View
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function CreateHrRequestDialog({
  open,
  onOpenChange,
  types,
  initialRequestTypeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: HrRequestType[];
  initialRequestTypeId: string;
}) {
  const createMutation = useCreateHrRequest();
  const [step, setStep] = useState<1 | 2>(1);
  const [requestTypeId, setRequestTypeId] = useState(initialRequestTypeId);
  const [remarks, setRemarks] = useState("");
  const [attachmentUploadSessionId, setAttachmentUploadSessionId] = useState<
    string | undefined
  >();
  const [attachmentState, setAttachmentState] =
    useState<UploadClientState>("idle");
  const selectedType = types.find((type) => type.id === requestTypeId);
  const attachmentSettled =
    attachmentState === "idle" || attachmentState === "clean";
  const attachmentInProgress =
    attachmentState === "selecting" ||
    attachmentState === "uploading" ||
    attachmentState === "uploaded" ||
    attachmentState === "scanning";

  const handleAttachmentStateChange = useCallback(
    (nextState: UploadClientState) => {
      setAttachmentState(nextState);
      if (nextState !== "clean") setAttachmentUploadSessionId(undefined);
    },
    [],
  );

  const close = () => {
    onOpenChange(false);
    setStep(1);
    setRequestTypeId("");
    setRemarks("");
    setAttachmentUploadSessionId(undefined);
    setAttachmentState("idle");
  };

  const submit = async () => {
    if (!requestTypeId) return;
    try {
      await createMutation.mutateAsync({
        requestTypeId,
        remarks: remarks.trim() || undefined,
        attachmentUploadSessionId,
        operationId: createOperationId(),
      });
      toast.success("HR request submitted.");
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not submit HR request."));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl max-sm:w-[calc(100%-1rem)]">
        <DialogHeader className="border-b px-5 py-4 pr-14">
          <div className="flex items-start gap-3">
            <span className="bg-primary-soft text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
              <FilePlus2 className="size-5" />
            </span>
            <div>
              <DialogTitle>New HR request</DialogTitle>
              <DialogDescription className="mt-1">
                Enter the request details, then review before submitting.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5" hidden={step !== 1}>
              <div>
                <h3 className="text-base font-semibold">Request details</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Choose a service and provide the information HR needs.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="my-hr-request-type">Request type</Label>
                <Select value={requestTypeId} onValueChange={setRequestTypeId}>
                  <SelectTrigger id="my-hr-request-type" aria-label="Request type">
                    <SelectValue placeholder="Select a request type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.requestName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="my-hr-request-remarks">Remarks</Label>
                <Textarea
                  id="my-hr-request-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Add any details that will help HR process this request."
                  className="min-h-28"
                />
              </div>
              <SecureFileUploadField
                label="Attachment (optional)"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                maxSizeMb={25}
                onSessionReady={setAttachmentUploadSessionId}
                onStateChange={handleAttachmentStateChange}
                createSession={HrOperationsApiService.createRequestUploadSession}
                finalizeSession={HrOperationsApiService.finalizeRequestUploadSession}
                pollSession={HrOperationsApiService.pollRequestUploadSession}
                disabled={createMutation.isPending}
                allowRemove
              />
              <p className="text-muted-foreground text-xs">
                PDF, Word, JPG or PNG. Maximum file size 25 MB.
              </p>
          </div>
          {step === 2 ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold">Review & submit</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Confirm these details before submitting your request.
                </p>
              </div>
              <dl className="divide-y rounded-xl border">
                <ReviewRow label="Request type" value={selectedType?.requestName ?? "-"} />
                <ReviewRow label="Request code" value={selectedType?.requestCode ?? "-"} />
                <ReviewRow
                  label="Approval"
                  value={
                    selectedType?.requiresApproval === false
                      ? "No approval required"
                      : selectedType?.workflow?.workflowName ?? "Approval required"
                  }
                />
                <ReviewRow label="Remarks" value={remarks.trim() || "No remarks"} />
                <ReviewRow
                  label="Attachment"
                  value={attachmentUploadSessionId ? "Attachment ready" : "No attachment"}
                />
              </dl>
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-0 border-t bg-card px-5 py-4 sm:justify-between">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button
              type="button"
              disabled={!requestTypeId || !attachmentSettled}
              onClick={() => setStep(2)}
            >
              {attachmentInProgress ? "Preparing attachment..." : "Review request"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                type="button"
                disabled={createMutation.isPending || !attachmentSettled}
                onClick={() => void submit()}
              >
                {createMutation.isPending ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium sm:text-right">{value}</dd>
    </div>
  );
}

function RequestDetailsSheet({
  request,
  onOpenChange,
}: {
  request: HrRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(request)} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 pr-14">
          <SheetTitle>Request details</SheetTitle>
          <SheetDescription>{request?.requestNo}</SheetDescription>
        </SheetHeader>
        {request ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <p className="text-lg font-semibold">
                {request.requestType?.requestName ?? "HR request"}
              </p>
              <div className="mt-2">
                <StatusBadge
                  label={STATUS_PRESENTATION[request.status].label}
                  tone={STATUS_PRESENTATION[request.status].tone}
                />
              </div>
            </div>
            <dl className="divide-y rounded-xl border">
              <ReviewRow label="Request number" value={request.requestNo} />
              <ReviewRow
                label="Submitted"
                value={displayDate(request.requestDate ?? request.createdAt)}
              />
              {request.completedAt ? (
                <ReviewRow label="Completed" value={displayDate(request.completedAt)} />
              ) : null}
              {waitingOn(request) ? (
                <ReviewRow label="Waiting on" value={waitingOn(request) ?? "-"} />
              ) : null}
              <ReviewRow label="Remarks" value={request.remarks?.trim() || "No remarks"} />
            </dl>
            <RequestAttachment request={request} />
          </div>
        ) : null}
        <SheetFooter className="border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RequestAttachment({ request }: { request: HrRequest }) {
  const [loading, setLoading] = useState(false);
  const present = Boolean(request.attachment?.present ?? request.fileObjectId);

  if (!present) {
    return (
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">Attachment</p>
        <p className="text-muted-foreground mt-1 text-sm">No attachment</p>
      </div>
    );
  }

  const openAttachment = async () => {
    setLoading(true);
    try {
      const grant =
        await HrOperationsApiService.createRequestAttachmentDownloadGrant(request.id);
      window.open(grant.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not open attachment."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Paperclip className="text-muted-foreground size-4 shrink-0" />
        <p className="truncate text-sm font-medium">
          {request.attachment?.fileName ?? "Attached file"}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => void openAttachment()}
      >
        {loading ? "Opening..." : "View file"}
      </Button>
    </div>
  );
}

function RequestCommandDialog({
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
  const setOpen = (open: boolean) => {
    if (!open) setReason("");
    onOpenChange(open);
  };

  const submit = async () => {
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
      toast.success(
        selected.action === "APPROVE"
          ? "Request approved."
          : selected.action === "REJECT"
            ? "Request rejected."
            : selected.action === "COMPLETE"
              ? "Request completed."
              : "Request cancelled.",
      );
      setReason("");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update HR request."));
    }
  };

  return (
    <Dialog open={Boolean(selected)} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selected ? ACTION_LABELS[selected.action] : "Request action"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-sm">{selected?.request.requestNo}</p>
          <div className="space-y-2">
            <Label htmlFor="my-hr-request-action-reason">
              {requiresReason ? "Reason (required)" : "Remarks (optional)"}
            </Label>
            <Textarea
              id="my-hr-request-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {businessReasonHint(requiresReason)}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={!selected || commandMutation.isPending || !reasonOk}
            onClick={() => void submit()}
          >
            {commandMutation.isPending
              ? "Saving..."
              : selected
                ? ACTION_LABELS[selected.action]
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
