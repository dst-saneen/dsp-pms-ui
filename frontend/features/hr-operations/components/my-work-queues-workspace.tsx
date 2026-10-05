"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  Laptop,
  LockKeyhole,
  RefreshCw,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useClearanceQueue,
  usePendingHrRequestApprovals,
  usePendingSeparationApprovals,
} from "../hooks";
import { actorLabel, displayDate } from "../lib/allowed-actions";
import type {
  ActorSummary,
  BranchSummary,
  ClearanceAction,
  EmployeeClearanceItem,
  EmployeeSeparation,
  HrRequest,
  HrRequestAction,
  SeparationAction,
} from "../types";
import { ClearanceActionDialog } from "./separation-detail-workspace";
import { SeparationActionDialog } from "./separation-workspace";
import { RequestActionDialog, RequestAttachmentCell } from "./hr-request-workspace";

const PAGE_SIZE = 8;

const requestActionLabel: Record<HrRequestAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  COMPLETE: "Complete",
  CANCEL: "Cancel",
};

const separationActionLabel: Record<SeparationAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  CANCEL: "Cancel",
  COMPLETE: "Complete",
};

type QueueTab = "approvals" | "clearance";
type ApprovalRow =
  { kind: "request"; data: HrRequest } | { kind: "separation"; data: EmployeeSeparation };
type SelectedRow = ApprovalRow | { kind: "clearance"; data: EmployeeClearanceItem };

interface QueueFilters {
  search: string;
  branchId: string;
  employeeId: string;
  type: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  requirement: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterOptions {
  branches: FilterOption[];
  employees: FilterOption[];
  types: FilterOption[];
  statuses: FilterOption[];
  departments: FilterOption[];
}

const emptyFilters: QueueFilters = {
  search: "",
  branchId: "",
  employeeId: "",
  type: "",
  status: "",
  dateFrom: "",
  dateTo: "",
  departmentId: "",
  requirement: "",
};

export function MyWorkQueuesWorkspace() {
  const requestApprovals = usePendingHrRequestApprovals();
  const separationApprovals = usePendingSeparationApprovals();
  const clearanceQueue = useClearanceQueue();
  const [activeTab, setActiveTab] = useState<QueueTab>("approvals");
  const [selectedRow, setSelectedRow] = useState<SelectedRow | null>(null);
  const [requestAction, setRequestAction] = useState<{
    request: HrRequest;
    action: HrRequestAction;
  } | null>(null);
  const [separationAction, setSeparationAction] = useState<{
    separation: EmployeeSeparation;
    action: SeparationAction;
  } | null>(null);
  const [clearanceAction, setClearanceAction] = useState<{
    item: EmployeeClearanceItem;
    action: ClearanceAction;
  } | null>(null);

  const requestItems = requestApprovals.data?.items ?? [];
  const separationItems = separationApprovals.data?.items ?? [];
  const clearanceItems = clearanceQueue.data?.items ?? [];
  const requestCount = requestApprovals.data?.total ?? requestItems.length;
  const separationCount = separationApprovals.data?.total ?? separationItems.length;
  const clearanceCount = clearanceQueue.data?.total ?? clearanceItems.length;
  const approvalCount = requestCount + separationCount;
  const actionableClearanceCount = clearanceItems.filter((item) =>
    (item.allowedActions ?? []).includes("CLEAR")
  ).length;
  const awaitingCount = approvalCount + actionableClearanceCount;

  const approvalRows: ApprovalRow[] = [
    ...requestItems.map((data) => ({ kind: "request" as const, data })),
    ...separationItems.map((data) => ({ kind: "separation" as const, data })),
  ].sort(
    (left, right) =>
      left.data.createdAt.localeCompare(right.data.createdAt) ||
      left.data.id.localeCompare(right.data.id)
  );

  const refreshing =
    requestApprovals.isFetching || separationApprovals.isFetching || clearanceQueue.isFetching;

  function refreshQueues() {
    void Promise.all([
      requestApprovals.refetch(),
      separationApprovals.refetch(),
      clearanceQueue.refetch(),
    ]);
  }

  return (
    <WorkspaceShell className="gap-4 md:gap-5">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <span className="sr-only" aria-label={countPhrase(approvalCount, "approval")} />
        <SummaryStrip
          awaiting={awaitingCount}
          requests={requestCount}
          separations={separationCount}
          clearance={clearanceCount}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 self-end sm:self-auto"
          disabled={refreshing}
          onClick={refreshQueues}
        >
          <RefreshCw className={cn(refreshing && "animate-spin motion-reduce:animate-none")} />
          Refresh
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as QueueTab);
          setSelectedRow(null);
        }}
      >
        <TabsList
          variant="line"
          className="border-border h-11 w-full justify-start gap-2 overflow-x-auto border-b px-1 sm:gap-5"
          aria-label="Approval queues"
        >
          <TabsTrigger value="approvals" className="h-10 flex-none gap-2 px-2">
            Approvals
            <CountBadge count={approvalCount} />
          </TabsTrigger>
          <TabsTrigger
            value="clearance"
            className="h-10 flex-none gap-2 px-2"
            aria-label={`Department clearance ${clearanceCount}`}
          >
            <span className="sm:hidden">Clearance</span>
            <span className="hidden sm:inline">Department clearance</span>
            <CountBadge count={clearanceCount} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="mt-4">
          <ApprovalQueue
            rows={approvalRows}
            loading={requestApprovals.isLoading || separationApprovals.isLoading}
            error={requestApprovals.error ?? separationApprovals.error}
            onRetry={() => {
              void Promise.all([requestApprovals.refetch(), separationApprovals.refetch()]);
            }}
            selectedRow={selectedRow}
            onSelect={setSelectedRow}
          />
        </TabsContent>

        <TabsContent value="clearance" className="mt-4">
          <ClearanceQueue
            rows={clearanceItems}
            loading={clearanceQueue.isLoading}
            error={clearanceQueue.error}
            onRetry={() => void clearanceQueue.refetch()}
            selectedRow={selectedRow}
            onSelect={(data) => setSelectedRow({ kind: "clearance", data })}
          />
        </TabsContent>
      </Tabs>

      <QueueDetailsDrawer
        selected={selectedRow}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        onRequestAction={(request, action) => {
          setSelectedRow(null);
          setRequestAction({ request, action });
        }}
        onSeparationAction={(separation, action) => {
          setSelectedRow(null);
          setSeparationAction({ separation, action });
        }}
        onClearanceAction={(item, action) => {
          setSelectedRow(null);
          setClearanceAction({ item, action });
        }}
      />
      <RequestActionDialog
        selected={requestAction}
        onOpenChange={(open) => !open && setRequestAction(null)}
      />
      <SeparationActionDialog
        selected={separationAction}
        onOpenChange={(open) => !open && setSeparationAction(null)}
      />
      <ClearanceActionDialog
        selected={clearanceAction}
        onOpenChange={(open) => !open && setClearanceAction(null)}
      />
    </WorkspaceShell>
  );
}

function SummaryStrip({
  awaiting,
  requests,
  separations,
  clearance,
}: {
  awaiting: number;
  requests: number;
  separations: number;
  clearance: number;
}) {
  return (
    <section
      aria-label="Queue summary"
      className="border-border bg-card grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-xl border shadow-xs lg:grid-cols-4"
    >
      <SummaryMetric
        icon={Clock3}
        iconClassName="bg-warning-soft text-warning-foreground"
        count={awaiting}
        label="Awaiting my action"
        accessibleLabel={countPhrase(awaiting, "awaiting my action", "awaiting my action")}
      />
      <SummaryMetric
        icon={FileText}
        iconClassName="bg-information-soft text-information-foreground"
        count={requests}
        label="HR requests"
        accessibleLabel={countPhrase(requests, "HR request")}
      />
      <SummaryMetric
        icon={Users}
        iconClassName="bg-danger-soft text-destructive"
        count={separations}
        label="Separations"
        accessibleLabel={countPhrase(separations, "separation")}
      />
      <SummaryMetric
        icon={ClipboardCheck}
        iconClassName="bg-success-soft text-success-foreground"
        count={clearance}
        label="Clearance items"
        accessibleLabel={countPhrase(clearance, "clearance item")}
      />
    </section>
  );
}

function SummaryMetric({
  icon: Icon,
  iconClassName,
  count,
  label,
  accessibleLabel,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  iconClassName: string;
  count: number;
  label: string;
  accessibleLabel: string;
}) {
  return (
    <div
      aria-label={accessibleLabel}
      className="border-border flex min-w-0 items-center gap-3 px-3 py-3 even:border-l lg:border-l lg:first:border-l-0"
    >
      <span
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}
      >
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xl leading-none font-semibold tabular-nums">{count}</span>
        <span className="text-muted-foreground mt-1 block text-xs leading-4">{label}</span>
      </span>
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">
      {count}
    </Badge>
  );
}

function ApprovalQueue({
  rows,
  loading,
  error,
  onRetry,
  selectedRow,
  onSelect,
}: {
  rows: ApprovalRow[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selectedRow: SelectedRow | null;
  onSelect: (row: ApprovalRow) => void;
}) {
  const [draft, setDraft] = useState<QueueFilters>(emptyFilters);
  const [filters, setFilters] = useState<QueueFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const options = useMemo(() => buildApprovalFilterOptions(rows), [rows]);
  const filteredRows = useMemo(
    () => rows.filter((row) => matchesApprovalFilters(row, filters)),
    [rows, filters]
  );
  const hasActiveFilters = hasFilters(filters);
  const pagination = paginate(filteredRows, page);

  if (loading) return <QueueLoading label="Loading approvals" />;
  if (error) {
    return (
      <QueueError
        title="Could not load approvals"
        description={getApiErrorMessage(error, "Please try again.")}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      <FilterArea
        mode="approvals"
        draft={draft}
        applied={filters}
        options={options}
        onDraftChange={setDraft}
        onApply={() => {
          setFilters(draft);
          setPage(1);
        }}
        onClear={() => {
          setDraft(emptyFilters);
          setFilters(emptyFilters);
          setPage(1);
        }}
        onRemove={(key) => {
          const next = { ...filters, [key]: "" };
          setFilters(next);
          setDraft(next);
          setPage(1);
        }}
      />

      {rows.length === 0 ? (
        <QueueEmpty
          icon={CheckCircle2}
          tone="success"
          title="You're all caught up"
          description="No approval requests are currently assigned to you."
        />
      ) : filteredRows.length === 0 ? (
        <QueueEmpty
          icon={Search}
          title="No approvals match these filters"
          description="Clear one or more filters to view assigned requests."
        />
      ) : (
        <>
          <ApprovalTable rows={pagination.items} selectedRow={selectedRow} onSelect={onSelect} />
          <PaginationFooter
            page={pagination.page}
            pageCount={pagination.pageCount}
            start={pagination.start}
            end={pagination.end}
            total={filteredRows.length}
            itemLabel={hasActiveFilters ? "matching approvals" : "approvals"}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function ClearanceQueue({
  rows,
  loading,
  error,
  onRetry,
  selectedRow,
  onSelect,
}: {
  rows: EmployeeClearanceItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  selectedRow: SelectedRow | null;
  onSelect: (row: EmployeeClearanceItem) => void;
}) {
  const [draft, setDraft] = useState<QueueFilters>(emptyFilters);
  const [filters, setFilters] = useState<QueueFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const options = useMemo(() => buildClearanceFilterOptions(rows), [rows]);
  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) => matchesClearanceFilters(row, filters))
        .sort(
          (left, right) =>
            Number((right.allowedActions ?? []).includes("CLEAR")) -
            Number((left.allowedActions ?? []).includes("CLEAR"))
        ),
    [rows, filters]
  );
  const hasActiveFilters = hasFilters(filters);
  const pagination = paginate(filteredRows, page);

  if (loading) return <QueueLoading label="Loading department clearance" />;
  if (error) {
    return (
      <QueueError
        title="Could not load department clearance"
        description={getApiErrorMessage(error, "Please try again.")}
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      <FilterArea
        mode="clearance"
        draft={draft}
        applied={filters}
        options={options}
        onDraftChange={setDraft}
        onApply={() => {
          setFilters(draft);
          setPage(1);
        }}
        onClear={() => {
          setDraft(emptyFilters);
          setFilters(emptyFilters);
          setPage(1);
        }}
        onRemove={(key) => {
          const next = { ...filters, [key]: "" };
          setFilters(next);
          setDraft(next);
          setPage(1);
        }}
      />

      {rows.length === 0 ? (
        <QueueEmpty
          icon={CheckCircle2}
          tone="success"
          title="All department clearance items are complete"
          description="There is currently nothing assigned to your department."
        />
      ) : filteredRows.length === 0 ? (
        <QueueEmpty
          icon={Search}
          title="No clearance items match these filters"
          description="Clear one or more filters to view assigned items."
        />
      ) : (
        <>
          <ClearanceTable rows={pagination.items} selectedRow={selectedRow} onSelect={onSelect} />
          <PaginationFooter
            page={pagination.page}
            pageCount={pagination.pageCount}
            start={pagination.start}
            end={pagination.end}
            total={filteredRows.length}
            itemLabel={hasActiveFilters ? "matching clearance items" : "clearance items"}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

function FilterArea({
  mode,
  draft,
  applied,
  options,
  onDraftChange,
  onApply,
  onClear,
  onRemove,
}: {
  mode: QueueTab;
  draft: QueueFilters;
  applied: QueueFilters;
  options: FilterOptions;
  onDraftChange: (filters: QueueFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onRemove: (key: keyof QueueFilters) => void;
}) {
  const isMobile = useMobileViewport();
  const [mobileOpen, setMobileOpen] = useState(false);
  const panel = (
    <FilterPanel
      mode={mode}
      draft={draft}
      applied={applied}
      options={options}
      onDraftChange={onDraftChange}
      onApply={() => {
        onApply();
        setMobileOpen(false);
      }}
      onClear={onClear}
      onRemove={onRemove}
    />
  );

  if (!isMobile) return panel;

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setMobileOpen(true)}>
        <Filter />
        Filters
        {hasFilters(applied) ? <span className="bg-primary size-2 rounded-full" /> : null}
      </Button>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="right"
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="border-border border-b px-5 py-4 pr-14">
            <SheetTitle>Filter {mode === "approvals" ? "approvals" : "clearance"}</SheetTitle>
            <SheetDescription>Refine the rows assigned to you.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{panel}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterPanel({
  mode,
  draft,
  applied,
  options,
  onDraftChange,
  onApply,
  onClear,
  onRemove,
}: {
  mode: QueueTab;
  draft: QueueFilters;
  applied: QueueFilters;
  options: FilterOptions;
  onDraftChange: (filters: QueueFilters) => void;
  onApply: () => void;
  onClear: () => void;
  onRemove: (key: keyof QueueFilters) => void;
}) {
  const chips = filterChips(mode, applied, options);
  const update = (key: keyof QueueFilters, value: string) =>
    onDraftChange({ ...draft, [key]: value });

  return (
    <section className="border-border bg-card rounded-xl border p-3 shadow-xs" aria-label="Filters">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="relative md:col-span-2">
          <Label htmlFor={`${mode}-search`} className="mb-1.5 block text-xs">
            Search
          </Label>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute bottom-2.5 left-3 size-4"
          />
          <Input
            id={`${mode}-search`}
            type="search"
            className="pl-9"
            aria-label={`Search ${mode}`}
            placeholder={
              mode === "approvals"
                ? "Search employee, code, request or separation"
                : "Search employee, code, item or separation"
            }
            value={draft.search}
            onChange={(event) => update("search", event.target.value)}
          />
        </div>
        <NativeFilterSelect
          id={`${mode}-branch`}
          label="Branch"
          value={draft.branchId}
          allLabel="All branches"
          options={options.branches}
          onChange={(value) => update("branchId", value)}
        />
        <NativeFilterSelect
          id={`${mode}-employee`}
          label="Employee"
          value={draft.employeeId}
          allLabel="All employees"
          options={options.employees}
          onChange={(value) => update("employeeId", value)}
        />
        <NativeFilterSelect
          id={`${mode}-type`}
          label={mode === "approvals" ? "Request type" : "Clearance type"}
          value={draft.type}
          allLabel="All types"
          options={options.types}
          onChange={(value) => update("type", value)}
        />
        {mode === "clearance" ? (
          <NativeFilterSelect
            id="clearance-requirement"
            label="Requirement"
            value={draft.requirement}
            allLabel="All requirements"
            options={[{ value: "mandatory", label: "Mandatory" }]}
            onChange={(value) => update("requirement", value)}
          />
        ) : null}
        <NativeFilterSelect
          id={`${mode}-status`}
          label="Status"
          value={draft.status}
          allLabel="All statuses"
          options={options.statuses}
          onChange={(value) => update("status", value)}
        />
        {mode === "clearance" ? (
          <NativeFilterSelect
            id="clearance-department"
            label="Responsible department"
            value={draft.departmentId}
            allLabel="All departments"
            options={options.departments}
            onChange={(value) => update("departmentId", value)}
          />
        ) : null}
        <DateFilter
          id={`${mode}-date-from`}
          label={mode === "approvals" ? "Relevant date from" : "Last working date from"}
          value={draft.dateFrom}
          onChange={(value) => update("dateFrom", value)}
        />
        <DateFilter
          id={`${mode}-date-to`}
          label={mode === "approvals" ? "Relevant date to" : "Last working date to"}
          value={draft.dateTo}
          onChange={(value) => update("dateTo", value)}
        />
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClear}>
            Clear filters
          </Button>
          <Button type="button" className="flex-1" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      </div>

      {chips.length > 0 ? (
        <div
          className="border-border mt-3 flex flex-wrap gap-2 border-t pt-3"
          aria-label="Applied filters"
        >
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="h-7 gap-1 rounded-md pr-1.5">
              {chip.label}
              <button
                type="button"
                className="hover:bg-background focus-visible:ring-ring rounded-sm p-0.5 focus-visible:ring-2 focus-visible:outline-none"
                aria-label={`Remove ${chip.label} filter`}
                onClick={() => onRemove(chip.key)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NativeFilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs">
        {label}
      </Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/20 h-9 w-full rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-3 max-sm:h-11"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateFilter({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs">
        {label}
      </Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function ApprovalTable({
  rows,
  selectedRow,
  onSelect,
}: {
  rows: ApprovalRow[];
  selectedRow: SelectedRow | null;
  onSelect: (row: ApprovalRow) => void;
}) {
  return (
    <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-xs">
      <table className="w-full min-w-[1540px] text-sm max-md:block max-md:min-w-0">
        <thead className="bg-muted/55 text-muted-foreground text-left text-xs max-md:hidden">
          <tr>
            <TableHeading>Request no.</TableHeading>
            <TableHeading>Type</TableHeading>
            <TableHeading>Category</TableHeading>
            <TableHeading>Employee</TableHeading>
            <TableHeading>Branch</TableHeading>
            <TableHeading>Submitted</TableHeading>
            <TableHeading>Last working date</TableHeading>
            <TableHeading>Current step</TableHeading>
            <TableHeading>Attachment</TableHeading>
            <TableHeading>Waiting time</TableHeading>
            <TableHeading>Status</TableHeading>
            <TableHeading className="text-right">Actions</TableHeading>
          </tr>
        </thead>
        <tbody className="max-md:bg-muted/30 max-md:block max-md:space-y-2 max-md:p-2">
          {rows.map((row) => {
            const rowId = approvalRowId(row);
            const title = approvalTitle(row);
            const selected = selectedRow?.kind === row.kind && selectedRow.data.id === row.data.id;
            const employee = approvalEmployee(row);
            const branch = approvalBranch(row);
            const requestNumber = row.kind === "request" ? row.data.requestNo : "—";
            const category = row.kind === "request" ? "HR request" : "Separation";
            const lastWorkingDate =
              row.kind === "separation" ? displayDate(row.data.lastWorkingDate) : "—";
            const currentStep = approvalCurrentStep(row);
            const currentApprover = approvalCurrentApprover(row);
            const attachment = approvalAttachment(row);
            return (
              <tr
                key={rowId}
                aria-label={`Open ${title}`}
                className={cn(
                  "border-border max-md:bg-card border-t transition-colors first:border-t-0 max-md:block max-md:rounded-lg max-md:border max-md:p-3",
                  selected &&
                    "bg-primary-soft/60 hover:bg-primary-soft/70 shadow-[inset_3px_0_0_var(--primary)]"
                )}
              >
                <TableCell label="Request no.">
                  <p className="font-medium">{requestNumber}</p>
                </TableCell>
                <td className="px-4 py-3.5 align-top max-md:block max-md:px-0 max-md:py-1">
                  <span className="text-muted-foreground hidden text-xs font-medium max-md:mb-2 max-md:block">
                    Type
                  </span>
                  <div className="flex items-start gap-3">
                    <ItemIcon type={row.kind === "request" ? "HR" : "SEPARATION"} />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{title}</p>
                    </div>
                  </div>
                </td>
                <TableCell label="Category">{category}</TableCell>
                <TableCell label="Employee">
                  <p className="font-medium">{actorLabel(employee)}</p>
                  {employee?.employeeCode ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{employee.employeeCode}</p>
                  ) : null}
                </TableCell>
                <TableCell label="Branch">{branchLabel(branch, approvalBranchId(row))}</TableCell>
                <TableCell label="Submitted">
                  {row.data.createdAt ? displayDateTime(row.data.createdAt) : "—"}
                </TableCell>
                <TableCell label="Last working date">{lastWorkingDate}</TableCell>
                <TableCell label="Current step">
                  <p className="font-medium">{currentStep}</p>
                  {currentApprover ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">{currentApprover}</p>
                  ) : null}
                </TableCell>
                <TableCell label="Attachment">
                  <p>{attachment.label}</p>
                  {attachment.detail ? (
                    <p className="text-muted-foreground mt-0.5 max-w-32 truncate text-xs">
                      {attachment.detail}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell label="Waiting time">{waitingTimeLabel(row.data.createdAt)}</TableCell>
                <TableCell label="Status">
                  <SemanticStatus status={row.data.status} />
                </TableCell>
                <td className="px-4 py-3.5 text-right align-top max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`View ${title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row);
                    }}
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClearanceTable({
  rows,
  selectedRow,
  onSelect,
}: {
  rows: EmployeeClearanceItem[];
  selectedRow: SelectedRow | null;
  onSelect: (row: EmployeeClearanceItem) => void;
}) {
  return (
    <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-xs">
      <table className="w-full min-w-[1180px] text-sm max-md:block max-md:min-w-0">
        <thead className="bg-muted/55 text-muted-foreground text-left text-xs max-md:hidden">
          <tr>
            <TableHeading>Clearance item</TableHeading>
            <TableHeading>Employee</TableHeading>
            <TableHeading>Separation</TableHeading>
            <TableHeading>Branch</TableHeading>
            <TableHeading>Responsible department</TableHeading>
            <TableHeading>Requirement</TableHeading>
            <TableHeading>Cleared information</TableHeading>
            <TableHeading>Status</TableHeading>
            <TableHeading className="text-right">Actions</TableHeading>
          </tr>
        </thead>
        <tbody className="max-md:bg-muted/30 max-md:block max-md:space-y-2 max-md:p-2">
          {rows.map((item) => {
            const selected = selectedRow?.kind === "clearance" && selectedRow.data.id === item.id;
            return (
              <tr
                key={item.id}
                aria-label={`Open ${item.title}`}
                className={cn(
                  "border-border max-md:bg-card border-t transition-colors first:border-t-0 max-md:block max-md:rounded-lg max-md:border max-md:p-3",
                  selected &&
                    "bg-primary-soft/60 hover:bg-primary-soft/70 shadow-[inset_3px_0_0_var(--primary)]"
                )}
              >
                <td className="px-4 py-3.5 align-top max-md:block max-md:px-0 max-md:py-1">
                  <div className="flex items-start gap-3">
                    <ItemIcon type={item.itemType} />
                    <div className="min-w-0">
                      <p className="text-foreground font-medium">{item.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {humanize(item.itemType)}
                      </p>
                    </div>
                  </div>
                </td>
                <TableCell label="Employee">
                  <p className="font-medium">{actorLabel(item.employee)}</p>
                  {item.employee?.employeeCode ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {item.employee.employeeCode}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell label="Separation">
                  {item.separation?.separationType ? (
                    <p>{humanize(item.separation.separationType)}</p>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                  {item.separation?.lastWorkingDate ? (
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      LWD {displayDate(item.separation.lastWorkingDate)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell label="Branch">{branchLabel(item.branch)}</TableCell>
                <TableCell label="Responsible department">
                  {item.executorDepartmentName ?? "—"}
                </TableCell>
                <TableCell label="Requirement">
                  <RequirementBadge mandatory={item.mandatory} />
                </TableCell>
                <TableCell label="Cleared information">
                  {item.clearedBy || item.clearedAt ? (
                    <>
                      {item.clearedBy ? (
                        <p className="font-medium">{actorLabel(item.clearedBy)}</p>
                      ) : null}
                      {item.clearedAt ? (
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {displayDateTime(item.clearedAt)}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell label="Status">
                  <SemanticStatus status={item.status} />
                </TableCell>
                <td className="px-4 py-3.5 text-right align-top max-md:block max-md:px-0 max-md:pt-3 max-md:pb-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label={`View ${item.title}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(item);
                    }}
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableHeading({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium whitespace-nowrap", className)}>{children}</th>;
}

function TableCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <td className="px-4 py-3.5 align-top max-md:grid max-md:grid-cols-[9rem_minmax(0,1fr)] max-md:gap-3 max-md:px-0 max-md:py-2">
      <span className="text-muted-foreground hidden text-xs font-medium max-md:block">{label}</span>
      <div>{children}</div>
    </td>
  );
}

function ItemIcon({ type }: { type: string }) {
  const normalized = type.toUpperCase();
  const Icon =
    normalized === "ASSET" || normalized === "IT"
      ? Laptop
      : normalized === "SEPARATION"
        ? Users
        : FileText;
  const color =
    normalized === "ASSET" || normalized === "IT"
      ? "bg-information-soft text-information-foreground"
      : normalized === "FINANCE"
        ? "bg-warning-soft text-warning-foreground"
        : normalized === "HR" || normalized === "SEPARATION"
          ? "bg-danger-soft text-destructive"
          : "bg-success-soft text-success-foreground";
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", color)}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function SemanticStatus({ status }: { status: string }) {
  return <StatusBadge label={humanize(status)} tone={statusTone(status)} />;
}

function RequirementBadge({ mandatory }: { mandatory: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-md",
        mandatory
          ? "border-destructive/15 bg-danger-soft text-destructive"
          : "border-border bg-muted text-muted-foreground"
      )}
    >
      {mandatory ? "Mandatory" : "Optional"}
    </Badge>
  );
}

function QueueDetailsDrawer({
  selected,
  onOpenChange,
  onRequestAction,
  onSeparationAction,
  onClearanceAction,
}: {
  selected: SelectedRow | null;
  onOpenChange: (open: boolean) => void;
  onRequestAction: (request: HrRequest, action: HrRequestAction) => void;
  onSeparationAction: (separation: EmployeeSeparation, action: SeparationAction) => void;
  onClearanceAction: (item: EmployeeClearanceItem, action: ClearanceAction) => void;
}) {
  const title = selected ? selectedTitle(selected) : "Queue details";
  const status = selected?.data.status;

  return (
    <Sheet open={Boolean(selected)} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[34rem]">
        <SheetHeader className="border-border border-b px-5 py-4 pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{title}</SheetTitle>
            {status ? <SemanticStatus status={status} /> : null}
          </div>
          <SheetDescription>
            {selected ? selectedDescription(selected) : "Assigned queue item"}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {selected?.kind === "request" ? <RequestDetails request={selected.data} /> : null}
          {selected?.kind === "separation" ? (
            <SeparationDetails separation={selected.data} />
          ) : null}
          {selected?.kind === "clearance" ? <ClearanceDetails item={selected.data} /> : null}
        </div>

        {selected ? (
          <SheetFooter className="border-border bg-card border-t px-5 py-4">
            <DrawerActions
              selected={selected}
              onRequestAction={onRequestAction}
              onSeparationAction={onSeparationAction}
              onClearanceAction={onClearanceAction}
            />
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function RequestDetails({ request }: { request: HrRequest }) {
  const hasAttachment = Boolean(request.attachment?.present ?? request.fileObjectId);
  return (
    <div className="space-y-5">
      <EmployeeSection employee={request.employee} branch={request.branch} />
      <DetailSection title="Request information" icon={FileText}>
        <DetailGrid>
          <Detail label="Request number" value={request.requestNo} />
          <Detail label="Request type" value={request.requestType?.requestName} />
          <Detail
            label="Request date"
            value={request.requestDate ? displayDate(request.requestDate) : undefined}
          />
          <Detail
            label="Submitted"
            value={request.createdAt ? displayDateTime(request.createdAt) : undefined}
          />
        </DetailGrid>
        {request.remarks ? <DetailBlock label="Remarks" value={request.remarks} /> : null}
      </DetailSection>
      {hasAttachment ? (
        <DetailSection title="Attachment" icon={FileText}>
          <RequestAttachmentCell request={request} />
        </DetailSection>
      ) : null}
    </div>
  );
}

function SeparationDetails({ separation }: { separation: EmployeeSeparation }) {
  return (
    <div className="space-y-5">
      <EmployeeSection employee={separation.employee} branch={separation.branch} />
      <DetailSection title="Separation information" icon={FileText}>
        <DetailGrid>
          <Detail
            label="Separation type"
            value={separation.separationType ? humanize(separation.separationType) : undefined}
          />
          <Detail label="Last working date" value={displayDate(separation.lastWorkingDate)} />
          <Detail
            label="Submitted"
            value={separation.createdAt ? displayDateTime(separation.createdAt) : undefined}
          />
        </DetailGrid>
        {separation.reason ? <DetailBlock label="Reason" value={separation.reason} /> : null}
        {separation.clearanceSummary ? (
          <ClearanceProgress
            cleared={separation.clearanceSummary.mandatoryCleared}
            total={separation.clearanceSummary.mandatoryTotal}
          />
        ) : null}
      </DetailSection>
    </div>
  );
}

function ClearanceDetails({ item }: { item: EmployeeClearanceItem }) {
  return (
    <div className="space-y-5">
      <EmployeeSection employee={item.employee} branch={item.branch} />
      {item.separation ? (
        <DetailSection title="Separation information" icon={FileText}>
          <DetailGrid>
            <Detail
              label="Separation type"
              value={
                item.separation.separationType
                  ? humanize(item.separation.separationType)
                  : undefined
              }
            />
            <Detail
              label="Last working date"
              value={
                item.separation.lastWorkingDate
                  ? displayDate(item.separation.lastWorkingDate)
                  : undefined
              }
            />
          </DetailGrid>
          {item.separation.reason ? (
            <DetailBlock label="Reason" value={item.separation.reason} />
          ) : null}
        </DetailSection>
      ) : null}
      <DetailSection title="Clearance responsibility" icon={Building2}>
        <DetailGrid>
          <Detail label="Clearance item" value={item.title} />
          <Detail label="Item type" value={humanize(item.itemType)} />
          <Detail label="Responsible department" value={item.executorDepartmentName} />
          <div>
            <p className="text-muted-foreground text-xs">Requirement</p>
            <div className="mt-1">
              <RequirementBadge mandatory={item.mandatory} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Current status</p>
            <div className="mt-1">
              <SemanticStatus status={item.status} />
            </div>
          </div>
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Clearance record" icon={Clock3}>
        {item.status.toUpperCase() === "PENDING" ? (
          <div className="border-warning/20 bg-warning-soft text-warning-foreground rounded-lg border px-3 py-3 text-sm">
            This item is waiting for your department&apos;s clearance.
          </div>
        ) : (
          <DetailGrid>
            <Detail
              label="Cleared by"
              value={item.clearedBy ? actorLabel(item.clearedBy) : undefined}
            />
            <Detail
              label="Cleared date"
              value={item.clearedAt ? displayDateTime(item.clearedAt) : undefined}
            />
            {item.status.toUpperCase() === "REOPENED" ? (
              <div>
                <p className="text-muted-foreground text-xs">Status</p>
                <div className="mt-1">
                  <SemanticStatus status={item.status} />
                </div>
              </div>
            ) : null}
          </DetailGrid>
        )}
      </DetailSection>
    </div>
  );
}

function EmployeeSection({
  employee,
  branch,
}: {
  employee?: ActorSummary | null;
  branch?: BranchSummary | null;
}) {
  const hasEmployeeInformation = Boolean(
    employee &&
    (actorLabel(employee) !== "—" ||
      employee.employeeCode ||
      employee.department?.departmentName ||
      employee.designation?.designationName)
  );
  if (!hasEmployeeInformation && !branch) return null;

  return (
    <DetailSection title="Employee information" icon={UserRound}>
      <DetailGrid>
        <Detail
          label="Name"
          value={employee && actorLabel(employee) !== "—" ? actorLabel(employee) : undefined}
        />
        <Detail label="Employee code" value={employee?.employeeCode} />
        <Detail label="Branch" value={branch?.branchName} />
        <Detail label="Department" value={employee?.department?.departmentName} />
        <Detail label="Designation" value={employee?.designation?.designationName} />
      </DetailGrid>
    </DetailSection>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
}) {
  return (
    <section className="border-border border-b pb-5 last:border-b-0 last:pb-0">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="text-muted-foreground size-4" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">{children}</div>;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 mt-4 rounded-lg px-3 py-2.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ClearanceProgress({ cleared, total }: { cleared: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, Math.round((cleared / total) * 100)) : 0;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Mandatory clearance</span>
        <span className="font-medium">
          {cleared} of {total} items cleared
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Mandatory clearance progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={cleared}
        className="bg-muted mt-2 h-2 overflow-hidden rounded-full"
      >
        <div className="bg-success h-full rounded-full" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function DrawerActions({
  selected,
  onRequestAction,
  onSeparationAction,
  onClearanceAction,
}: {
  selected: SelectedRow;
  onRequestAction: (request: HrRequest, action: HrRequestAction) => void;
  onSeparationAction: (separation: EmployeeSeparation, action: SeparationAction) => void;
  onClearanceAction: (item: EmployeeClearanceItem, action: ClearanceAction) => void;
}) {
  if (selected.kind === "request") {
    const actions = selected.data.allowedActions ?? [];
    if (actions.length === 0) return <ViewOnly />;
    return (
      <div className="flex w-full flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === "REJECT" || action === "CANCEL" ? "outline" : "default"}
            onClick={() => onRequestAction(selected.data, action)}
          >
            {requestActionLabel[action]}
          </Button>
        ))}
      </div>
    );
  }

  if (selected.kind === "separation") {
    const actions = selected.data.allowedActions ?? [];
    if (actions.length === 0) return <ViewOnly />;
    return (
      <div className="flex w-full flex-wrap justify-end gap-2">
        {actions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === "REJECT" || action === "CANCEL" ? "outline" : "default"}
            onClick={() => onSeparationAction(selected.data, action)}
          >
            {separationActionLabel[action]}
          </Button>
        ))}
      </div>
    );
  }

  const actions = selected.data.allowedActions ?? [];
  if (actions.length === 0) return <ViewOnly />;
  return (
    <div className="flex w-full flex-wrap justify-end gap-2">
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={action === "REOPEN" ? "outline" : "default"}
          onClick={() => onClearanceAction(selected.data, action)}
        >
          {action === "CLEAR" ? "Clear item" : "Reopen"}
        </Button>
      ))}
    </div>
  );
}

function ViewOnly() {
  return (
    <div className="text-muted-foreground flex w-full items-center justify-end gap-2 text-sm">
      <LockKeyhole className="size-4" aria-hidden="true" />
      View only
    </div>
  );
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label={label}>
      <div className="border-border bg-card rounded-xl border p-3" aria-label="Loading filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-14 md:col-span-2" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </div>
      <div
        className="border-border space-y-0 overflow-hidden rounded-xl border"
        aria-label="Loading table rows"
      >
        <Skeleton className="h-11 w-full rounded-none" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="border-border grid grid-cols-6 gap-4 border-t p-4">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ))}
      </div>
    </div>
  );
}

function QueueError({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-danger-soft/40 rounded-xl border px-6 py-10 text-center"
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
      <Button type="button" variant="outline" className="mt-5" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function QueueEmpty({
  icon: Icon,
  tone = "neutral",
  title,
  description,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "neutral" | "success";
  title: string;
  description: string;
}) {
  return (
    <div className="border-border rounded-xl border border-dashed px-6 py-12 text-center">
      <span
        className={cn(
          "mx-auto flex size-11 items-center justify-center rounded-xl",
          tone === "success"
            ? "bg-success-soft text-success-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-md text-sm">{description}</p>
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  start,
  end,
  total,
  itemLabel,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing {start}–{end} of {total} {itemLabel}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 tabular-nums">
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function buildApprovalFilterOptions(rows: ApprovalRow[]): FilterOptions {
  return {
    branches: uniqueOptions(
      rows.map((row) => ({
        value: approvalBranch(row)?.id ?? approvalBranchId(row) ?? "",
        label: branchLabel(approvalBranch(row), approvalBranchId(row)),
      }))
    ),
    employees: uniqueOptions(
      rows.map((row) => ({
        value: approvalEmployee(row)?.id ?? row.data.employeeId,
        label: employeeOptionLabel(approvalEmployee(row), row.data.employeeId),
      }))
    ),
    types: uniqueOptions(
      rows.map((row) =>
        row.kind === "request"
          ? {
              value: `request:${row.data.requestTypeId}`,
              label: row.data.requestType?.requestName ?? "HR request",
            }
          : {
              value: `separation:${row.data.separationType ?? "SEPARATION"}`,
              label: row.data.separationType ? humanize(row.data.separationType) : "Separation",
            }
      )
    ),
    statuses: uniqueOptions(
      rows.map((row) => ({ value: row.data.status, label: humanize(row.data.status) }))
    ),
    departments: [],
  };
}

function buildClearanceFilterOptions(rows: EmployeeClearanceItem[]): FilterOptions {
  return {
    branches: uniqueOptions(
      rows.map((row) => ({
        value: row.branch?.id ?? "",
        label: branchLabel(row.branch),
      }))
    ),
    employees: uniqueOptions(
      rows.map((row) => ({
        value: row.employee?.id ?? "",
        label: employeeOptionLabel(row.employee),
      }))
    ),
    types: uniqueOptions(
      rows.map((row) => ({ value: row.itemType, label: humanize(row.itemType) }))
    ),
    statuses: uniqueOptions(
      rows.map((row) => ({ value: row.status, label: humanize(row.status) }))
    ),
    departments: uniqueOptions(
      rows.map((row) => ({
        value: row.executorDepartmentId ?? "",
        label: row.executorDepartmentName ?? row.executorDepartmentId ?? "",
      }))
    ),
  };
}

function matchesApprovalFilters(row: ApprovalRow, filters: QueueFilters): boolean {
  const employee = approvalEmployee(row);
  const branch = approvalBranch(row);
  const typeValue =
    row.kind === "request"
      ? `request:${row.data.requestTypeId}`
      : `separation:${row.data.separationType ?? "SEPARATION"}`;
  const searchText = [
    approvalTitle(row),
    row.data.id,
    actorLabel(employee),
    employee?.employeeCode,
    branch?.branchName,
    branch?.branchCode,
    row.kind === "request" ? row.data.requestNo : row.data.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    includesSearch(searchText, filters.search) &&
    (!filters.branchId || filters.branchId === (branch?.id ?? approvalBranchId(row))) &&
    (!filters.employeeId || filters.employeeId === (employee?.id ?? row.data.employeeId)) &&
    (!filters.type || filters.type === typeValue) &&
    (!filters.status || filters.status === row.data.status) &&
    matchesDateRange(approvalRelevantDate(row), filters.dateFrom, filters.dateTo)
  );
}

function matchesClearanceFilters(item: EmployeeClearanceItem, filters: QueueFilters): boolean {
  const searchText = [
    item.title,
    item.itemType,
    item.id,
    item.separationId,
    item.separation?.id,
    item.separation?.separationType,
    actorLabel(item.employee),
    item.employee?.employeeCode,
    item.branch?.branchName,
    item.branch?.branchCode,
    item.executorDepartmentName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const requirement = item.mandatory ? "mandatory" : "optional";

  return (
    includesSearch(searchText, filters.search) &&
    (!filters.branchId || filters.branchId === item.branch?.id) &&
    (!filters.employeeId || filters.employeeId === item.employee?.id) &&
    (!filters.type || filters.type === item.itemType) &&
    (!filters.status || filters.status === item.status) &&
    (!filters.departmentId || filters.departmentId === item.executorDepartmentId) &&
    (!filters.requirement || filters.requirement === requirement) &&
    matchesDateRange(item.separation?.lastWorkingDate, filters.dateFrom, filters.dateTo)
  );
}

function filterChips(mode: QueueTab, filters: QueueFilters, options: FilterOptions) {
  const chips: Array<{ key: keyof QueueFilters; label: string }> = [];
  const addOption = (key: keyof QueueFilters, prefix: string, optionList: FilterOption[]) => {
    const value = filters[key];
    if (!value) return;
    chips.push({
      key,
      label: `${prefix}: ${optionList.find((option) => option.value === value)?.label ?? humanize(value)}`,
    });
  };
  if (filters.search.trim())
    chips.push({ key: "search", label: `Search: ${filters.search.trim()}` });
  addOption("branchId", "Branch", options.branches);
  addOption("employeeId", "Employee", options.employees);
  addOption("type", mode === "approvals" ? "Type" : "Clearance type", options.types);
  addOption("status", "Status", options.statuses);
  addOption("departmentId", "Department", options.departments);
  if (filters.requirement) {
    chips.push({ key: "requirement", label: `Requirement: ${humanize(filters.requirement)}` });
  }
  if (filters.dateFrom)
    chips.push({ key: "dateFrom", label: `From: ${displayDate(filters.dateFrom)}` });
  if (filters.dateTo) chips.push({ key: "dateTo", label: `To: ${displayDate(filters.dateTo)}` });
  return chips;
}

function uniqueOptions(options: FilterOption[]): FilterOption[] {
  const unique = new Map<string, string>();
  for (const option of options) {
    if (option.value && option.label && option.label !== "—")
      unique.set(option.value, option.label);
  }
  return Array.from(unique, ([value, label]) => ({ value, label })).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
}

function paginate<T>(items: T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const startIndex = (page - 1) * PAGE_SIZE;
  return {
    items: items.slice(startIndex, startIndex + PAGE_SIZE),
    page,
    pageCount,
    start: items.length === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + PAGE_SIZE, items.length),
  };
}

function approvalRowId(row: ApprovalRow) {
  return `${row.kind}:${row.data.id}`;
}

function approvalTitle(row: ApprovalRow) {
  return row.kind === "request"
    ? (row.data.requestType?.requestName ?? row.data.requestNo)
    : row.data.separationType
      ? humanize(row.data.separationType)
      : "Separation";
}

function approvalEmployee(row: ApprovalRow) {
  return row.data.employee;
}

function approvalBranch(row: ApprovalRow) {
  return row.data.branch;
}

function approvalBranchId(row: ApprovalRow) {
  return row.data.branchId;
}

function approvalRelevantDate(row: ApprovalRow) {
  return row.kind === "request"
    ? (row.data.requestDate ?? row.data.createdAt)
    : row.data.lastWorkingDate;
}

function approvalCurrentStep(row: ApprovalRow) {
  if (row.kind === "request") {
    return typeof row.data.approvalTransaction?.currentStep === "number"
      ? `Step ${row.data.approvalTransaction.currentStep}`
      : "—";
  }
  return row.data.approvalProgress?.currentStepName ?? "—";
}

function approvalCurrentApprover(row: ApprovalRow) {
  if (row.kind === "request") {
    const approver = row.data.approvalTransaction?.pendingApprover;
    return approver && actorLabel(approver) !== "—" ? actorLabel(approver) : null;
  }
  return row.data.approvalProgress?.currentApproverLabel ?? null;
}

function approvalAttachment(row: ApprovalRow) {
  if (row.kind === "separation") return { label: "—", detail: null };
  const present = Boolean(row.data.attachment?.present ?? row.data.fileObjectId);
  return present
    ? { label: "1 attachment", detail: row.data.attachment?.fileName ?? null }
    : { label: "No attachment", detail: null };
}

function waitingTimeLabel(value?: string | null) {
  if (!value) return "—";
  const submittedAt = new Date(value).valueOf();
  if (Number.isNaN(submittedAt)) return "—";
  const elapsedDays = Math.max(0, Math.floor((Date.now() - submittedAt) / 86_400_000));
  if (elapsedDays === 0) return "Less than 1 day waiting";
  return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} waiting`;
}

function selectedTitle(selected: SelectedRow) {
  if (selected.kind === "request")
    return selected.data.requestType?.requestName ?? selected.data.requestNo;
  if (selected.kind === "separation") {
    return selected.data.separationType ? humanize(selected.data.separationType) : "Separation";
  }
  return selected.data.title;
}

function selectedDescription(selected: SelectedRow) {
  if (selected.kind === "request") return selected.data.requestNo;
  if (selected.kind === "separation")
    return `Last working date ${displayDate(selected.data.lastWorkingDate)}`;
  return humanize(selected.data.itemType);
}

function branchLabel(branch?: BranchSummary | null, fallbackId?: string | null) {
  return branch?.branchName ?? fallbackId ?? "—";
}

function employeeOptionLabel(employee?: ActorSummary | null, fallbackId?: string) {
  const name = actorLabel(employee);
  if (name !== "—" && employee?.employeeCode) return `${name} (${employee.employeeCode})`;
  return name !== "—" ? name : (fallbackId ?? "—");
}

function includesSearch(haystack: string, needle: string) {
  return !needle.trim() || haystack.includes(needle.trim().toLowerCase());
}

function matchesDateRange(value: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

function hasFilters(filters: QueueFilters) {
  return Object.values(filters).some((value) => value.trim().length > 0);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusTone(status: string): StatusTone {
  const normalized = status.toUpperCase();
  if (
    normalized.includes("REJECT") ||
    normalized.includes("CANCEL") ||
    normalized.includes("BLOCK")
  ) {
    return "danger";
  }
  if (
    normalized.includes("CLEAR") ||
    normalized.includes("APPROV") ||
    normalized.includes("COMPLETE")
  ) {
    return "success";
  }
  if (normalized.includes("REOPEN")) return "information";
  if (normalized.includes("PROGRESS")) return "progress";
  if (normalized.includes("PENDING")) return "warning";
  return "neutral";
}

function displayDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function countPhrase(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function useMobileViewport() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return mobile;
}
