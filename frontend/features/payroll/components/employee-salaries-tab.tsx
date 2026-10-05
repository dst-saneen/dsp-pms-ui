"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useState } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupService } from "@/features/lookups/services/lookup-service";
import { createOperationId } from "@/lib/operation-id";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";
import { useQuery } from "@tanstack/react-query";

import {
  useCreateSalaryRevision,
  useEndSalaryRevision,
  useSalaryComponents,
  useSalaryRevisions,
} from "../hooks";
import type { SalaryRevision } from "../types";
import { formatMoney } from "../lib/format";

type DraftLine = {
  key: string;
  salaryComponentId: string;
  amount: string;
};

export function EmployeeSalariesTab() {
  const { data: capabilities } = useModuleCapabilities();
  const canView = Boolean(capabilities?.payroll && capabilities.payrollNav);
  const canManage =
    capabilities?.payroll &&
    (capabilities.payrollActions?.includes("MANAGE_EMPLOYEE_INPUTS") ?? false);
  const [employeeId, setEmployeeId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const employees = useQuery({
    queryKey: ["lookups", "managers"],
    queryFn: () => LookupService.getManagers(),
  });
  const revisions = useSalaryRevisions(employeeId, Boolean(employeeId) && canView);
  const [endTarget, setEndTarget] = useState<SalaryRevision | null>(null);
  const current = (revisions.data ?? []).find((row) => !row.effectiveTo);

  const columns: ColumnDef<SalaryRevision>[] = [
    {
      accessorKey: "effectiveFrom",
      header: "Effective from",
      cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleDateString(),
    },
    {
      accessorKey: "effectiveTo",
      header: "Effective to",
      cell: ({ row }) =>
        row.original.effectiveTo
          ? new Date(row.original.effectiveTo).toLocaleDateString()
          : "Current",
    },
    {
      id: "lines",
      header: "Lines",
      cell: ({ row }) => row.original.lines.length,
    },
    {
      id: "total",
      header: "Total",
      cell: ({ row }) => {
        const total = row.original.lines.reduce(
          (sum, line) => sum + Number.parseFloat(line.amount),
          0
        );
        return formatMoney(total.toFixed(2));
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        canManage && !row.original.effectiveTo ? (
          <Button
            size="sm"
            variant="outline"
            title="Set the real last effective date for this salary package"
            onClick={() => setEndTarget(row.original)}
          >
            End
          </Button>
        ) : null,
    },
  ];

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm">
        Employee salary configuration is not enabled for your active Company and Branch.
      </p>
    );
  }

  return (
    <>
      <PageToolbar>
        <div className="flex flex-wrap items-end gap-3">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {(employees.data ?? []).map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name} ({employee.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {employees.isLoading ? (
            <p className="text-muted-foreground text-xs">Loading employees…</p>
          ) : null}
          {employees.error ? (
            <p className="text-destructive text-xs">
              {getApiErrorMessage(employees.error, "Could not load employees.")}
            </p>
          ) : null}
          {!employees.isLoading && !employees.error && (employees.data?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-xs">
              No active employees in this Company. Create or activate employees under HR → Employees
              first.
            </p>
          ) : null}
          {employeeId ? (
            <Button variant="outline" asChild>
              <Link href={`/hr/employees/${employeeId}?tab=salary`}>Open employee profile</Link>
            </Button>
          ) : null}
          {employeeId && canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              New revision
            </Button>
          ) : employeeId ? (
            <Button
              type="button"
              disabled
              title="Needs payroll manage permission to create salary revisions."
            >
              <Plus className="mr-1 size-4" />
              New revision
            </Button>
          ) : null}
        </div>
      </PageToolbar>
      {employeeId && !canManage ? (
        <p className="text-muted-foreground mb-3 text-xs">
          New revision is disabled without payroll manage permission.
        </p>
      ) : null}
      {employeeId && canManage ? (
        <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
          Use <strong>New revision</strong> to replace current pay from a new effective date; the
          existing package closes automatically on the previous day. Use <strong>End</strong> only
          when the package stops without a replacement. Tax and deductions are configured in the
          adjacent tabs. Then continue to{" "}
          <Link href="/hr/payroll?tab=runs" className="underline">
            Runs
          </Link>
          .
        </p>
      ) : null}
      {!employeeId ? (
        <p className="text-muted-foreground mb-3 text-xs">
          Need components first? Open{" "}
          <Link href="/hr/payroll?tab=components" className="underline">
            Salary Components
          </Link>
          . When revisions exist, continue to{" "}
          <Link href="/hr/payroll?tab=runs" className="underline">
            Runs
          </Link>
          .
        </p>
      ) : null}

      {employeeId ? (
        <DataTable
          columns={columns}
          data={revisions.data ?? []}
          isLoading={revisions.isLoading}
          error={
            revisions.error
              ? getApiErrorMessage(revisions.error, "Could not load salary revisions.")
              : null
          }
          onRetry={() => void revisions.refetch()}
          emptyTitle="No salary revisions"
          emptyDescription="Create a salary revision for this employee."
          enablePagination
          pageSize={10}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Select an employee to view salary revision history.
        </p>
      )}

      {employeeId ? (
        <CreateSalaryRevisionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          employeeId={employeeId}
          currentVersion={current?.version}
          onCompleted={() => void revisions.refetch()}
        />
      ) : null}
      {employeeId && endTarget ? (
        <EndSalaryRevisionDialog
          key={endTarget.id}
          open
          onOpenChange={(open) => {
            if (!open) setEndTarget(null);
          }}
          employeeId={employeeId}
          revision={endTarget}
          onCompleted={() => {
            setEndTarget(null);
            void revisions.refetch();
          }}
        />
      ) : null}
    </>
  );
}

function CreateSalaryRevisionDialog({
  open,
  onOpenChange,
  employeeId,
  currentVersion,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  currentVersion?: number;
  onCompleted?: () => void;
}) {
  const create = useCreateSalaryRevision();
  const components = useSalaryComponents();
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([
    { key: "1", salaryComponentId: "", amount: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validLines = lines
      .map((line) => ({
        salaryComponentId: line.salaryComponentId,
        amount: line.amount.trim(),
      }))
      .filter((line) => line.salaryComponentId && line.amount);

    if (!effectiveFrom || validLines.length === 0) {
      setError("Effective date and at least one component line are required.");
      return;
    }

    setError(null);
    try {
      await create.mutateAsync({
        employeeId,
        data: {
          effectiveFrom,
          lines: validLines,
          expectedCurrentRevisionVersion: currentVersion,
          operationId: createOperationId(),
        },
      });
      setLines([{ key: "1", salaryComponentId: "", amount: "" }]);
      onOpenChange(false);
      onCompleted?.();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create salary revision."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create salary revision"
      description="Set effective date and component amounts."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-salary-revision-tab" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create revision"}
          </Button>
        </div>
      }
    >
      <form id="create-salary-revision-tab" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tab-effective-from">Effective from</Label>
          <Input
            id="tab-effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Use the first day of the payroll month when possible.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Component lines</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((current) => [
                  ...current,
                  {
                    key: `${Date.now()}`,
                    salaryComponentId: "",
                    amount: "",
                  },
                ])
              }
            >
              Add line
            </Button>
          </div>
          {lines.map((line) => (
            <div key={line.key} className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Select
                value={line.salaryComponentId}
                onValueChange={(value) => updateLine(line.key, { salaryComponentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select component" />
                </SelectTrigger>
                <SelectContent>
                  {(components.data?.items ?? [])
                    .filter((component) => component.isActive)
                    .map((component) => (
                      <SelectItem key={component.id} value={component.id}>
                        {component.componentName} ({component.componentType})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                inputMode="decimal"
                placeholder="Amount"
                value={line.amount}
                onChange={(event) => updateLine(line.key, { amount: event.target.value })}
              />
            </div>
          ))}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}

function EndSalaryRevisionDialog({
  open,
  onOpenChange,
  employeeId,
  revision,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  revision: SalaryRevision;
  onCompleted: () => void;
}) {
  const endRevision = useEndSalaryRevision();
  const effectiveFrom = revision.effectiveFrom.slice(0, 10);
  const [effectiveTo, setEffectiveTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!effectiveTo) {
      setError("Last effective date is required.");
      return;
    }
    if (effectiveTo < effectiveFrom) {
      setError("Last effective date cannot be before the revision start date.");
      return;
    }

    setError(null);
    try {
      await endRevision.mutateAsync({
        employeeId,
        revisionId: revision.id,
        data: {
          expectedVersion: revision.version,
          operationId: createOperationId(),
          effectiveTo,
        },
      });
      onCompleted();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to end salary revision."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="End salary revision"
      description="Set the final date on which this package applies."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="end-salary-revision" disabled={endRevision.isPending}>
            {endRevision.isPending ? "Ending…" : "End revision"}
          </Button>
        </div>
      }
    >
      <form id="end-salary-revision" onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="salary-revision-effective-to">Last effective date</Label>
          <Input
            id="salary-revision-effective-to"
            type="date"
            min={effectiveFrom}
            value={effectiveTo}
            onChange={(event) => setEffectiveTo(event.target.value)}
            required
          />
          <p className="text-muted-foreground text-xs">
            This revision started on {effectiveFrom}. Ending it does not rewrite historical start
            dates.
          </p>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
