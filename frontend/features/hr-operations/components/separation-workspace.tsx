"use client";

import Link from "next/link";
import { useState } from "react";
import { UserRoundMinus } from "lucide-react";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { LookupSelect } from "@/components/forms";
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
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";
import { useEmployees } from "@/features/employee/hooks/use-employees";

import {
  useCreateEmployeeSeparation,
  useClearanceDepartmentCandidates,
  useEmployeeSeparations,
  useSeparationCommand,
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
import type {
  EmployeeSeparation,
  SeparationAction,
} from "../types";
import { HrOpsPathBanner } from "./hr-ops-path-banner";

const actionLabel: Record<SeparationAction, string> = {
  APPROVE: "Approve",
  REJECT: "Reject",
  CANCEL: "Cancel",
  COMPLETE: "Complete",
};

export function SeparationWorkspace() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<{
    separation: EmployeeSeparation;
    action: SeparationAction;
  } | null>(null);
  const query = useEmployeeSeparations({
    status: status === "ALL" ? undefined : (status as EmployeeSeparation["status"]),
    keyword: keyword.trim() || undefined,
    page: 1,
    limit: 50,
  });
  const items = query.data?.items ?? [];

  return (
    <WorkspaceShell>
      <HrOpsPathBanner
        current="separations"
        note="HR starts separations. Approver decides. Departments clear their items (reason required). Complete only when clearance + assets are clear — employee is then deactivated."
      />
      <PageToolbar>
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            className="max-w-sm"
            placeholder="Search employees or reasons…"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending approval</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="CLEARANCE_IN_PROGRESS">Clearance in progress</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {hasAllowedAction(query.data?.allowedActions, "CREATE") ? (
            <Button onClick={() => setCreateOpen(true)}><UserRoundMinus className="mr-1 size-4" />New separation</Button>
          ) : (
            <Button
              type="button"
              disabled
              title="Requires HR employee manage. Managers can approve assigned separations but cannot start them."
            >
              New separation
            </Button>
          )}
        </div>
      </PageToolbar>

      {query.error ? (
        <WorkspaceMessage message={getApiErrorMessage(query.error, "Could not load employee separations.")} />
      ) : query.isLoading ? (
        <WorkspaceMessage message="Loading employee separations…" />
      ) : items.length === 0 ? (
        <WorkspaceMessage message="No employee separations match the selected filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium">Last working day</th><th className="px-4 py-3 font-medium">Clearance</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
            <tbody>{items.map((separation) => <tr className="border-t" key={separation.id}>
              <td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={`/hr/employee-separations/${separation.id}`}>{actorLabel(separation.employee)}</Link><p className="text-xs text-muted-foreground">{separation.reason}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{displayDate(separation.lastWorkingDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">{separation.clearanceSummary ? `${separation.clearanceSummary.mandatoryCleared}/${separation.clearanceSummary.mandatoryTotal} mandatory cleared` : "—"}</td>
              <td className="px-4 py-3"><StatusBadge label={separation.status} tone="neutral" /></td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" asChild><Link href={`/hr/employee-separations/${separation.id}`}>View</Link></Button>{(separation.allowedActions ?? []).map((action) => <Button key={action} size="sm" variant={action === "REJECT" || action === "CANCEL" ? "outline" : "default"} onClick={() => setSelectedAction({ separation, action })}>{actionLabel[action]}</Button>)}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}

      <CreateSeparationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <SeparationActionDialog selected={selectedAction} onOpenChange={(open) => !open && setSelectedAction(null)} />
    </WorkspaceShell>
  );
}

function WorkspaceMessage({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">{message}</div>;
}

function CreateSeparationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const mutation = useCreateEmployeeSeparation();
  const employees = useEmployees({ isActive: true });
  const [employeeId, setEmployeeId] = useState("");
  const [separationType, setSeparationType] = useState<"RESIGNATION" | "TERMINATION" | "RETIREMENT">("RESIGNATION");
  const [lastWorkingDate, setLastWorkingDate] = useState("");
  const [reason, setReason] = useState("");
  const [clearanceDepartments, setClearanceDepartments] = useState<Record<"HR" | "FINANCE" | "IT" | "ADMIN", string>>({ HR: "", FINANCE: "", IT: "", ADMIN: "" });
  const departmentCandidates = useClearanceDepartmentCandidates(employeeId.trim());
  const allClearanceDepartmentsSelected = Object.values(clearanceDepartments).every(Boolean);

  async function submit() {
    if (
      !employeeId.trim() ||
      !lastWorkingDate ||
      !isValidBusinessReason(reason) ||
      !allClearanceDepartmentsSelected
    ) {
      return;
    }
    try {
      await mutation.mutateAsync({ employeeId: employeeId.trim(), separationType, lastWorkingDate, reason: reason.trim(), clearanceDepartments: (["HR", "FINANCE", "IT", "ADMIN"] as const).map((clearanceType) => ({ clearanceType, executorDepartmentId: clearanceDepartments[clearanceType] })), operationId: createOperationId() });
      toast.success("Employee separation submitted for approval.");
      setEmployeeId(""); setLastWorkingDate(""); setReason(""); setClearanceDepartments({ HR: "", FINANCE: "", IT: "", ADMIN: "" });
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create employee separation."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>New employee separation</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-muted-foreground text-xs">
            Guided start: pick employee → type and last day → business reason →
            clearance owners. First submit also creates the Manager approval
            path if missing. Asset custody is checked later on the detail page
            before Complete.
          </p>
          <div className="space-y-2"><Label>Employee</Label><LookupSelect value={employeeId} onChange={(value) => { setEmployeeId(value); setClearanceDepartments({ HR: "", FINANCE: "", IT: "", ADMIN: "" }); }} items={(employees.data ?? []).map((employee) => ({ id: employee.id, code: employee.employeeCode, name: `${employee.firstName} ${employee.lastName ?? ""}`.trim() }))} placeholder="Select active employee" loading={employees.isLoading} clearable={false} /></div>
          <div className="space-y-2"><Label htmlFor="separation-type">Separation type</Label><Select value={separationType} onValueChange={(value) => setSeparationType(value as "RESIGNATION" | "TERMINATION" | "RETIREMENT")}><SelectTrigger id="separation-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="RESIGNATION">Resignation</SelectItem><SelectItem value="TERMINATION">Termination</SelectItem><SelectItem value="RETIREMENT">Retirement</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="separation-last-day">Last working date</Label><Input id="separation-last-day" type="date" value={lastWorkingDate} onChange={(event) => setLastWorkingDate(event.target.value)} /></div>
          <div className="space-y-2">
            <Label htmlFor="separation-reason">Reason (required)</Label>
            <Input id="separation-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="text-muted-foreground text-xs">{businessReasonHint(true)}</p>
          </div>
          <div className="space-y-2">
            <Label>Clearance departments</Label>
            <p className="text-xs text-muted-foreground">Choose active Departments in the selected employee&apos;s Company and Branch. Asset clearance is system-managed and is not configured here.</p>
            {(["HR", "FINANCE", "IT", "ADMIN"] as const).map((clearanceType) => <div className="grid grid-cols-[110px_1fr] items-center gap-2" key={clearanceType}><span className="text-sm">{clearanceType}</span><Select value={clearanceDepartments[clearanceType]} onValueChange={(value) => setClearanceDepartments((current) => ({ ...current, [clearanceType]: value }))} disabled={!employeeId.trim() || departmentCandidates.isLoading}><SelectTrigger><SelectValue placeholder={departmentCandidates.isLoading ? "Loading Departments…" : `Select ${clearanceType} Department`} /></SelectTrigger><SelectContent>{(departmentCandidates.data ?? []).map((department) => <SelectItem key={department.id} value={department.id}>{department.departmentName}{department.departmentCode ? ` (${department.departmentCode})` : ""}</SelectItem>)}</SelectContent></Select></div>)}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!employeeId.trim() || !lastWorkingDate || !isValidBusinessReason(reason) || !allClearanceDepartmentsSelected || mutation.isPending} onClick={() => void submit()}>{mutation.isPending ? "Submitting…" : "Submit"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SeparationActionDialog({ selected, onOpenChange }: { selected: { separation: EmployeeSeparation; action: SeparationAction } | null; onOpenChange: (open: boolean) => void }) {
  const mutation = useSeparationCommand();
  const [note, setNote] = useState("");
  const requiresReason =
    selected?.action === "REJECT" ||
    selected?.action === "CANCEL" ||
    Boolean(selected?.separation.actionRequirements?.requiresReason);
  const isComplete = selected?.action === "COMPLETE";
  const preflight = selected?.separation.completePreflight;
  const blockedComplete =
    isComplete &&
    preflight &&
    (!preflight.readyToComplete ||
      preflight.assetClearanceBlocked ||
      preflight.mandatoryOutstanding > 0);
  const reasonOk = !requiresReason || isValidBusinessReason(note);

  async function submit() {
    if (!selected || !reasonOk || blockedComplete) return;
    try {
      const noteValue = note.trim() || undefined;
      await mutation.mutateAsync({
        id: selected.separation.id,
        action: selected.action.toLowerCase() as
          | "approve"
          | "reject"
          | "cancel"
          | "complete",
        input: {
          expectedVersion:
            selected.separation.actionRequirements?.expectedVersion ??
            selected.separation.version,
          operationId: createOperationId(),
          ...(selected.action === "CANCEL"
            ? { reason: noteValue }
            : selected.action === "COMPLETE"
              ? { clearanceRemarks: noteValue }
              : { remarks: noteValue }),
        },
      });
      const successLabel: Record<SeparationAction, string> = {
        APPROVE: "Separation approved.",
        REJECT: "Separation rejected.",
        CANCEL: "Separation cancelled.",
        COMPLETE: "Separation completed. Employee access ends.",
      };
      toast.success(successLabel[selected.action]);
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Could not update the employee separation."),
      );
    }
  }

  return (
    <Dialog open={Boolean(selected)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selected ? actionLabel[selected.action] : "Separation action"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            {actorLabel(selected?.separation.employee)} · last working day{" "}
            {displayDate(selected?.separation.lastWorkingDate)}
          </p>
          {isComplete ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-medium">Before you complete</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                {(preflight?.effects ?? []).map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
              {blockedComplete ? (
                <p className="mt-2 text-xs font-medium">
                  Not ready:{" "}
                  {preflight?.assetClearanceBlocked
                    ? "asset custody still open — resolve via Assets / waivers. "
                    : ""}
                  {preflight && preflight.mandatoryOutstanding > 0
                    ? `${preflight.mandatoryOutstanding} mandatory clearance item(s) still open.`
                    : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs">
                  Clearance looks clear. Completing deactivates the employee.
                </p>
              )}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="separation-action-reason">
              {requiresReason
                ? "Reason (required)"
                : "Remarks (optional)"}
            </Label>
            <Textarea
              id="separation-action-reason"
              value={note}
              onChange={(event) => setNote(event.target.value)}
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
              !selected ||
              mutation.isPending ||
              !reasonOk ||
              Boolean(blockedComplete)
            }
            onClick={() => void submit()}
          >
            {mutation.isPending
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
