"use client";

import { useMemo, useState, type FormEvent } from "react";

import { FormSheet } from "@/components/common/form-sheet";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { getApiErrorMessage } from "@/services/api-client";

import { useCreateAttendancePeriod } from "../hooks/use-attendance-periods";

interface CreatePeriodSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePeriodSheet({ open, onOpenChange }: CreatePeriodSheetProps) {
  const createMutation = useCreateAttendancePeriod();
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [localError, setLocalError] = useState<string | null>(null);

  const companies = useCompanies();
  const branches = useBranches(companyId || undefined);
  const companyItems = useMemo(
    () =>
      (companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    [companies.data],
  );
  const branchItems = useMemo(
    () =>
      (branches.data ?? []).map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
      })),
    [branches.data],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branchId) {
      setLocalError("Select a branch first.");
      return;
    }
    setLocalError(null);
    try {
      await createMutation.mutateAsync({ branchId, periodYear, periodMonth });
      setCompanyId("");
      setBranchId("");
      onOpenChange(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Unable to create attendance period."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setLocalError(null);
        onOpenChange(next);
      }}
      title="Create attendance period"
      description="Create a monthly period for a branch."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            type="submit"
            form="create-attendance-period-form"
            disabled={createMutation.isPending || !branchId}
            title={!branchId ? "Select a company and branch first" : "Create period"}
          >
            {createMutation.isPending ? "Creating…" : "Create period"}
          </Button>
        </div>
      }
    >
      <form id="create-attendance-period-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label>Company</Label>
          <LookupSelect
            value={companyId}
            onChange={(value) => {
              setCompanyId(value);
              setBranchId("");
            }}
            items={companyItems}
            placeholder="Company"
            loading={companies.isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Branch</Label>
          <LookupSelect
            value={branchId}
            onChange={setBranchId}
            items={branchItems}
            placeholder="Branch"
            loading={branches.isLoading}
            disabled={!companyId}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="period-year">Year</Label>
            <Input id="period-year" type="number" min={2000} max={2100} value={periodYear} onChange={(event) => setPeriodYear(Number(event.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-month">Month</Label>
            <Input id="period-month" type="number" min={1} max={12} value={periodMonth} onChange={(event) => setPeriodMonth(Number(event.target.value))} required />
          </div>
        </div>
        {localError ? <p className="text-destructive text-sm">{localError}</p> : null}
      </form>
    </FormSheet>
  );
}
