"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

import {
  useArchiveRecurringDeduction,
  useCreateRecurringDeduction,
  useRecurringDeductions,
} from "../hooks";
import { formatMoney } from "../lib/format";
import type { RecurringDeduction } from "../types";

export function RecurringDeductionsTab() {
  const { data: capabilities } = useModuleCapabilities();
  const canManage =
    capabilities?.payroll &&
    (capabilities.payrollActions?.includes("MANAGE_EMPLOYEE_INPUTS") ?? false);
  const [employeeId, setEmployeeId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const employees = useQuery({
    queryKey: ["lookups", "managers"],
    queryFn: () => LookupService.getManagers(),
  });
  const deductions = useRecurringDeductions(employeeId, Boolean(employeeId));
  const archive = useArchiveRecurringDeduction();

  const columns: ColumnDef<RecurringDeduction>[] = [
    { accessorKey: "deductionName", header: "Name" },
    {
      accessorKey: "deductionCode",
      header: "Code",
      cell: ({ row }) => row.original.deductionCode ?? "—",
    },
    {
      accessorKey: "monthlyAmount",
      header: "Monthly amount",
      cell: ({ row }) => formatMoney(row.original.monthlyAmount),
    },
    { accessorKey: "startMonth", header: "Start" },
    {
      accessorKey: "endMonth",
      header: "End",
      cell: ({ row }) => row.original.endMonth ?? "Open",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        canManage && row.original.isActive ? (
          <Button
            size="sm"
            variant="outline"
            disabled={archive.isPending}
            onClick={() =>
              void archive.mutateAsync({
                employeeId,
                deductionId: row.original.id,
                data: {
                  expectedVersion: row.original.version,
                  operationId: createOperationId(),
                  reason: "Archived from payroll workspace",
                },
              })
            }
          >
            Archive
          </Button>
        ) : null,
    },
  ];

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
          {employeeId && canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 size-4" />
              New deduction
            </Button>
          ) : employeeId ? (
            <Button
              type="button"
              disabled
              title="Needs payroll manage permission to create recurring deductions."
            >
              <Plus className="mr-1 size-4" />
              New deduction
            </Button>
          ) : null}
        </div>
      </PageToolbar>

      {employeeId ? (
        <DataTable
          columns={columns}
          data={deductions.data ?? []}
          isLoading={deductions.isLoading}
          error={
            deductions.error
              ? getApiErrorMessage(
                  deductions.error,
                  "Could not load recurring deductions.",
                )
              : null
          }
          onRetry={() => void deductions.refetch()}
          emptyTitle="No recurring deductions"
          emptyDescription="Create a recurring deduction to include it in payroll calculation."
          enablePagination
          pageSize={10}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Select an employee to view recurring deductions.
        </p>
      )}

      {employeeId ? (
        <CreateDeductionDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          employeeId={employeeId}
        />
      ) : null}
    </>
  );
}

function CreateDeductionDialog({
  open,
  onOpenChange,
  employeeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
}) {
  const create = useCreateRecurringDeduction();
  const [deductionName, setDeductionName] = useState("");
  const [deductionCode, setDeductionCode] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [startMonth, setStartMonth] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [endMonth, setEndMonth] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!deductionName.trim() || !monthlyAmount.trim() || !startMonth) {
      setError("Name, amount, and start month are required.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        employeeId,
        data: {
          deductionName: deductionName.trim(),
          deductionCode: deductionCode.trim() || undefined,
          monthlyAmount: monthlyAmount.trim(),
          startMonth,
          endMonth: endMonth || undefined,
          operationId: createOperationId(),
        },
      });
      onOpenChange(false);
      setDeductionName("");
      setDeductionCode("");
      setMonthlyAmount("");
      setEndMonth("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create deduction."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create recurring deduction"
      description="Monthly deduction applied until archived or ended."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-deduction"
            disabled={create.isPending}
          >
            {create.isPending ? "Saving…" : "Create"}
          </Button>
        </div>
      }
    >
      <form id="create-deduction" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deduction-name">Name</Label>
          <Input
            id="deduction-name"
            value={deductionName}
            onChange={(event) => setDeductionName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-code">Code (optional)</Label>
          <Input
            id="deduction-code"
            value={deductionCode}
            onChange={(event) => setDeductionCode(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-amount">Monthly amount</Label>
          <Input
            id="deduction-amount"
            inputMode="decimal"
            value={monthlyAmount}
            onChange={(event) => setMonthlyAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-start">Start month</Label>
          <Input
            id="deduction-start"
            type="date"
            value={startMonth}
            onChange={(event) => setStartMonth(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-end">End month (optional)</Label>
          <Input
            id="deduction-end"
            type="date"
            value={endMonth}
            onChange={(event) => setEndMonth(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
