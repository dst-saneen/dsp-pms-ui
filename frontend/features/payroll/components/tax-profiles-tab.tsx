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
import { CompanyService } from "@/features/company/services/company-service";
import { createOperationId } from "@/lib/operation-id";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useCreateTaxProfile,
  useEndTaxProfile,
  useTaxProfiles,
} from "../hooks";
import { formatMoney } from "../lib/format";
import type { TaxProfile } from "../types";

export function TaxProfilesTab() {
  const { user } = useAuth();
  const { data: capabilities } = useModuleCapabilities();
  const canManage =
    capabilities?.payroll &&
    (capabilities.payrollActions?.includes("MANAGE_EMPLOYEE_INPUTS") ?? false);
  const [employeeId, setEmployeeId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const activeCompanyId = user?.authorization.activeCompanyId ?? "";
  const company = useQuery({
    queryKey: ["companies", activeCompanyId],
    queryFn: () => CompanyService.getById(activeCompanyId),
    enabled: Boolean(activeCompanyId),
  });
  const employees = useQuery({
    queryKey: ["lookups", "managers"],
    queryFn: () => LookupService.getManagers(),
  });
  const profiles = useTaxProfiles(employeeId, Boolean(employeeId));
  const endProfile = useEndTaxProfile();

  const columns: ColumnDef<TaxProfile>[] = [
    { accessorKey: "countryCode", header: "Country" },
    {
      accessorKey: "taxRegime",
      header: "Regime",
      cell: ({ row }) => row.original.taxRegime ?? "—",
    },
    {
      accessorKey: "monthlyTaxAmount",
      header: "Monthly tax",
      cell: ({ row }) => formatMoney(row.original.monthlyTaxAmount),
    },
    {
      accessorKey: "effectiveFrom",
      header: "From",
      cell: ({ row }) => row.original.effectiveFrom ?? "—",
    },
    {
      accessorKey: "effectiveTo",
      header: "To",
      cell: ({ row }) => row.original.effectiveTo ?? "Current",
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        canManage && row.original.isActive && !row.original.effectiveTo ? (
          <Button
            size="sm"
            variant="outline"
            disabled={endProfile.isPending}
            onClick={() =>
              void endProfile.mutateAsync({
                employeeId,
                profileId: row.original.id,
                data: {
                  expectedVersion: row.original.version,
                  operationId: createOperationId(),
                  effectiveTo: new Date().toISOString().slice(0, 10),
                },
              })
            }
          >
            End
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
              New tax profile
            </Button>
          ) : employeeId ? (
            <Button
              type="button"
              disabled
              title="Needs payroll manage permission to create tax profiles."
            >
              <Plus className="mr-1 size-4" />
              New tax profile
            </Button>
          ) : null}
        </div>
      </PageToolbar>

      {employeeId ? (
        <DataTable
          columns={columns}
          data={profiles.data ?? []}
          isLoading={profiles.isLoading}
          error={
            profiles.error
              ? getApiErrorMessage(
                  profiles.error,
                  "Could not load tax profiles.",
                )
              : null
          }
          onRetry={() => void profiles.refetch()}
          emptyTitle="No tax profiles"
          emptyDescription="Create a tax profile so payroll can apply monthly tax."
          enablePagination
          pageSize={10}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          Select an employee to view tax profiles.
        </p>
      )}

      {employeeId ? (
        <CreateTaxProfileDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          employeeId={employeeId}
          companyCountryCode={company.data?.legalCountryCode ?? ""}
          companyConfigurationLoading={company.isLoading}
        />
      ) : null}
    </>
  );
}

function CreateTaxProfileDialog({
  open,
  onOpenChange,
  employeeId,
  companyCountryCode,
  companyConfigurationLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  companyCountryCode: string;
  companyConfigurationLoading: boolean;
}) {
  const create = useCreateTaxProfile();
  const [taxRegime, setTaxRegime] = useState("");
  const [monthlyTaxAmount, setMonthlyTaxAmount] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!companyCountryCode.trim()) {
      setError("Configure the Company legal country before creating a tax profile.");
      return;
    }
    if (!monthlyTaxAmount.trim() || !effectiveFrom) {
      setError("Monthly tax amount and effective date are required.");
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        employeeId,
        data: {
          countryCode: companyCountryCode.trim().toUpperCase(),
          taxRegime: taxRegime.trim() || undefined,
          monthlyTaxAmount: monthlyTaxAmount.trim(),
          effectiveFrom,
          operationId: createOperationId(),
        },
      });
      onOpenChange(false);
      setMonthlyTaxAmount("");
      setTaxRegime("");
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create tax profile."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Create tax profile"
      description="Fixed monthly tax used by Payroll until the next profile."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-tax-profile"
            disabled={
              create.isPending ||
              companyConfigurationLoading ||
              !companyCountryCode.trim()
            }
          >
            {create.isPending ? "Saving…" : "Create"}
          </Button>
        </div>
      }
    >
      <form
        id="create-tax-profile"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="tax-country">Country code</Label>
          <Input
            id="tax-country"
            maxLength={2}
            value={companyCountryCode}
            readOnly
            aria-readonly="true"
            placeholder={companyConfigurationLoading ? "Loading…" : "Not configured"}
            className="bg-muted"
          />
          <p className="text-muted-foreground text-xs">Set by the Company legal country.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-regime">Regime (optional)</Label>
          <Input
            id="tax-regime"
            value={taxRegime}
            onChange={(event) => setTaxRegime(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-amount">Monthly tax amount</Label>
          <Input
            id="tax-amount"
            inputMode="decimal"
            value={monthlyTaxAmount}
            onChange={(event) => setMonthlyTaxAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax-from">Effective from</Label>
          <Input
            id="tax-from"
            type="date"
            value={effectiveFrom}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
