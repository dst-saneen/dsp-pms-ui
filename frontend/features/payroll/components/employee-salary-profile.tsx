"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { ErrorState } from "@/components/common";
import { FormSheet } from "@/components/common/form-sheet";
import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createOperationId } from "@/lib/operation-id";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useCreateSalaryRevision,
  useSalaryComponents,
  useSalaryRevisions,
} from "../hooks";
import { formatMoney } from "../lib/format";

interface EmployeeSalaryProfileProps {
  employeeId: string;
}

type DraftLine = {
  key: string;
  salaryComponentId: string;
  amount: string;
};

export function EmployeeSalaryProfile({
  employeeId,
}: EmployeeSalaryProfileProps) {
  const { data: capabilities } = useModuleCapabilities();
  const canRead = Boolean(capabilities?.payroll && capabilities.payrollNav);
  const canManage = Boolean(
    capabilities?.payroll &&
    capabilities.payrollActions?.includes("MANAGE_EMPLOYEE_INPUTS"),
  );

  const { data, isLoading, error, refetch } = useSalaryRevisions(
    employeeId,
    canRead,
  );
  const [createOpen, setCreateOpen] = useState(false);

  if (!canRead) {
    return (
      <p className="text-muted-foreground text-sm">
        Salary configuration is not enabled for your active Company and Branch.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load salary information"
        description="An unexpected error occurred while loading salary revisions."
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const revisions = data ?? [];
  const current = revisions.find((row) => !row.effectiveTo) ?? revisions[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Salary configuration</h3>
        {canManage ? (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 size-4" />
            New revision
          </Button>
        ) : null}
      </div>

      {!current ? (
        <p className="text-muted-foreground text-sm">
          No salary revisions are configured for this employee yet.
        </p>
      ) : (
        <>
          <InfoCard title="Current revision">
            <InfoRow
              label="Effective from"
              value={current.effectiveFrom.slice(0, 10)}
            />
            <InfoRow
              label="Effective to"
              value={
                current.effectiveTo ? current.effectiveTo.slice(0, 10) : "Open"
              }
            />
            <InfoRow label="Version" value={String(current.version)} />
          </InfoCard>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Component lines</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.lines.map((line) => (
                  <TableRow key={`${current.id}-${line.salaryComponentId}`}>
                    <TableCell>{line.componentName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{line.componentType}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {revisions.length > 1 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Revision history</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Effective from</TableHead>
                    <TableHead>Effective to</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revisions.map((revision) => (
                    <TableRow key={revision.id}>
                      <TableCell>
                        {revision.effectiveFrom.slice(0, 10)}
                      </TableCell>
                      <TableCell>
                        {revision.effectiveTo
                          ? revision.effectiveTo.slice(0, 10)
                          : "Open"}
                      </TableCell>
                      <TableCell>{revision.version}</TableCell>
                      <TableCell className="text-right">
                        {revision.lines.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}

      <CreateSalaryRevisionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        employeeId={employeeId}
        currentVersion={current?.version}
        onCompleted={() => void refetch()}
      />
    </div>
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
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lines, setLines] = useState<DraftLine[]>([
    { key: "1", salaryComponentId: "", amount: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
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
          <Button
            type="submit"
            form="create-salary-revision"
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create revision"}
          </Button>
        </div>
      }
    >
      <form
        id="create-salary-revision"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="effective-from">Effective from</Label>
          <Input
            id="effective-from"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
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
                onValueChange={(value) =>
                  updateLine(line.key, { salaryComponentId: value })
                }
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
                onChange={(event) =>
                  updateLine(line.key, { amount: event.target.value })
                }
              />
            </div>
          ))}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
