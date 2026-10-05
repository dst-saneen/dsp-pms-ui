"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import Link from "next/link";

import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
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
import { createOperationId } from "@/lib/operation-id";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { getApiErrorMessage } from "@/services/api-client";

import { useCreateSalaryComponent, useSalaryComponents } from "../hooks";
import type { SalaryComponent } from "../types";

export function SalaryComponentsTab() {
  const { data: capabilities } = useModuleCapabilities();
  const canManageComponents = capabilities?.payrollActions?.includes("MANAGE_COMPONENTS") ?? false;
  const query = useSalaryComponents();
  const create = useCreateSalaryComponent();
  const [open, setOpen] = useState(false);
  const [componentName, setComponentName] = useState("");
  const [componentCode, setComponentCode] = useState("");
  const [componentType, setComponentType] = useState<SalaryComponent["componentType"]>("EARNING");
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<SalaryComponent>[] = [
    { accessorKey: "componentCode", header: "Code" },
    { accessorKey: "componentName", header: "Name" },
    { accessorKey: "componentType", header: "Type" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? "Active" : "Archived"}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!componentName.trim()) return setError("Name is required.");
    setError(null);
    try {
      await create.mutateAsync({
        componentName: componentName.trim(),
        componentCode: componentCode.trim() || undefined,
        componentType,
        operationId: createOperationId(),
      });
      setComponentName("");
      setComponentCode("");
      setOpen(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create salary component."));
    }
  }

  return (
    <>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">
          Fixed earning and deduction components.
        </span>
        {canManageComponents ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" />
            Add component
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            title="Needs payroll manage permission to create salary components."
          >
            <Plus className="mr-1 size-4" />
            Add component
          </Button>
        )}
      </PageToolbar>
      {!canManageComponents ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can view components. Create is disabled without payroll manage permission.
        </p>
      ) : (
        <p className="text-muted-foreground mb-3 text-xs">
          After Basic / Allowance / Deduction exist, open{" "}
          <Link href="/hr/payroll?tab=salaries" className="underline">
            Employee Salaries
          </Link>
          .
        </p>
      )}
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        error={
          query.error ? getApiErrorMessage(query.error, "Could not load salary components.") : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No salary components"
        emptyDescription="Create components used in employee salary revisions."
        enablePagination
        pageSize={10}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="New salary component"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-salary-component" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="create-salary-component" onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="component-name">Name</Label>
            <Input
              id="component-name"
              value={componentName}
              placeholder="Example: Basic"
              onChange={(event) => setComponentName(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">Example: Basic or Housing Allowance.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="component-code">Code (optional)</Label>
            <Input
              id="component-code"
              value={componentCode}
              maxLength={40}
              placeholder="Auto-generated when blank"
              onChange={(event) => setComponentCode(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Leave blank to generate a unique code from the name.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={componentType}
              onValueChange={(value) => setComponentType(value as SalaryComponent["componentType"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EARNING">Earning (adds to pay)</SelectItem>
                <SelectItem value="DEDUCTION">Deduction (takes from pay)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </>
  );
}
