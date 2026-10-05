"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormSheet } from "@/components/common/form-sheet";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useBranches,
  useCompanies,
} from "@/features/lookups/hooks/use-lookups";
import { getApiErrorMessage } from "@/services/api-client";

import { useGenerateLeaveBalances } from "../hooks/use-generate-leave-balances";
import type { LeaveBalanceGenerationResult } from "../types/leave-balance";

interface GenerateLeaveBalancesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  year: number;
  companyId: string;
  branchId: string;
  dryRun: boolean;
}

export function GenerateLeaveBalancesSheet({
  open,
  onOpenChange,
}: GenerateLeaveBalancesSheetProps) {
  const [result, setResult] = useState<LeaveBalanceGenerationResult | null>(
    null,
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const generateMutation = useGenerateLeaveBalances();

  const form = useForm<FormValues>({
    defaultValues: {
      year: new Date().getFullYear(),
      companyId: "",
      branchId: "",
      dryRun: true,
    },
  });

  const companyId = useWatch({ control: form.control, name: "companyId" });
  const dryRun = useWatch({ control: form.control, name: "dryRun" });
  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: branches = [], isLoading: branchesLoading } =
    useBranches(companyId || undefined);

  async function onSubmit(values: FormValues) {
    setLocalError(null);
    try {
      const next = await generateMutation.mutateAsync({
        year: Number(values.year),
        companyId: values.companyId || undefined,
        branchId: values.branchId || undefined,
        dryRun: values.dryRun,
      });
      setResult(next);
      if (!values.dryRun) {
        onOpenChange(false);
        setResult(null);
        form.reset({
          year: new Date().getFullYear(),
          companyId: "",
          branchId: "",
          dryRun: true,
        });
      }
    } catch (error) {
      setLocalError(
        getApiErrorMessage(error, "Could not create leave balances."),
      );
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setResult(null);
          setLocalError(null);
        }
        onOpenChange(next);
      }}
      title="Give employees their leave days"
      description="Creates each person’s yearly leave balance from Policies. Preview first so you can check counts before saving."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button
            type="submit"
            form="generate-balances-form"
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending
              ? "Working…"
              : dryRun
                ? "Preview first"
                : "Create balances"}
          </Button>
        </div>
      }
    >
      <form
        id="generate-balances-form"
        className="space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="space-y-2">
          <RequiredLabel htmlFor="generate-leave-balances-year" required>
            Year
          </RequiredLabel>
          <Input
            id="generate-leave-balances-year"
            type="number"
            {...form.register("year", { valueAsNumber: true })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="generate-leave-balances-company">
            Company (optional)
          </Label>
          <Controller
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <LookupSelect
                id="generate-leave-balances-company"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue("branchId", "");
                }}
                items={companies}
                loading={companiesLoading}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="generate-leave-balances-branch">
            Branch (optional)
          </Label>
          <Controller
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <LookupSelect
                id="generate-leave-balances-branch"
                value={field.value}
                onChange={field.onChange}
                items={branches}
                loading={branchesLoading}
                disabled={!companyId}
              />
            )}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Do this after{" "}
          <a className="underline" href="/hr/leave/types">
            Types
          </a>{" "}
          and{" "}
          <a className="underline" href="/hr/leave/policies">
            Policies
          </a>
          . Preview only checks numbers. Create balances writes missing rows
          once — it does not wipe days already used.
        </p>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            {...form.register("dryRun")}
          />
          <span>
            Preview only (do not save yet)
            <span className="text-muted-foreground block text-xs">
              Recommended. Shows how many balances would be created without
              changing anything.
            </span>
          </span>
        </label>

        {localError ? (
          <p className="text-destructive text-sm">{localError}</p>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              {result.dryRun ? "Preview result" : "Saved result"} ·{" "}
              {result.year}
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">People included</dt>
                <dd className="font-medium">{result.eligibleEmployeeCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Policies used</dt>
                <dd className="font-medium">{result.applicablePolicyCount}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">New balances to add</dt>
                <dd className="font-medium">{result.balancesToCreate}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Already have a balance</dt>
                <dd className="font-medium">
                  {result.existingBalancesToRetain}
                </dd>
              </div>
              {!result.dryRun ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Created just now</dt>
                  <dd className="font-medium">{result.createdCount}</dd>
                </div>
              ) : null}
            </dl>
            {result.configurationErrors.length > 0 ? (
              <p className="text-destructive">
                {result.configurationErrors.length} setup problem
                {result.configurationErrors.length === 1 ? "" : "s"} — fix
                Types / Policies and try again.
              </p>
            ) : null}
            {result.employeesWithoutMatchingPolicy.length > 0 ? (
              <p className="text-amber-700">
                {result.employeesWithoutMatchingPolicy.length} employee
                {result.employeesWithoutMatchingPolicy.length === 1
                  ? ""
                  : "s"}{" "}
                have no matching policy for a leave type (often missing days
                for their job role in Policies).
              </p>
            ) : null}
            {result.dryRun && result.balancesToCreate > 0 ? (
              <p className="text-sm text-emerald-700">
                Looks ready. Uncheck Preview only, then click{" "}
                <strong>Create balances</strong>.
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </FormSheet>
  );
}
