"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import {
  useBranches,
  useCompanies,
  useDepartments,
  useDesignations,
} from "@/features/lookups/hooks/use-lookups";
import { useLeaveTypes } from "@/features/leave-type/hooks/use-leave-types";

import type { LeavePolicy } from "../types/leave-policy";
import { formatAnnualEntitlement, MAX_ANNUAL_ENTITLEMENT } from "../lib/leave-entitlement";
import { leavePolicySchema, type LeavePolicyFormValues } from "../validation/leave-policy-schema";

interface LeavePolicyFormProps {
  leavePolicy?: LeavePolicy | null;
  onSubmit: (data: LeavePolicyFormValues) => void;
}

export function LeavePolicyForm({ leavePolicy, onSubmit }: LeavePolicyFormProps) {
  const form = useForm<LeavePolicyFormValues>({
    resolver: zodResolver(leavePolicySchema),
    defaultValues: {
      companyId: "",
      branchId: "",
      departmentId: "",
      designationId: "",
      leaveTypeId: "",
      annualEntitlement: "12",
      carryForwardLimit: "",
      maxConsecutiveDays: "",
      allowNegativeBalance: false,
    },
  });

  const companyId = useWatch({ control: form.control, name: "companyId" });
  const branchId = useWatch({ control: form.control, name: "branchId" });

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: branches = [], isLoading: branchesLoading } = useBranches(companyId);
  const { data: departments = [], isLoading: departmentsLoading } = useDepartments(branchId, {
    enabled: Boolean(branchId),
  });
  const { data: designations = [], isLoading: designationsLoading } = useDesignations(companyId);
  const { data: leaveTypes = [], isLoading: leaveTypesLoading } = useLeaveTypes(
    companyId || undefined
  );

  useEffect(() => {
    if (!leavePolicy) {
      form.reset({
        companyId: "",
        branchId: "",
        departmentId: "",
        designationId: "",
        leaveTypeId: "",
        annualEntitlement: "12",
        carryForwardLimit: "",
        maxConsecutiveDays: "",
        allowNegativeBalance: false,
      });
      return;
    }

    form.reset({
      companyId: leavePolicy.companyId,
      branchId: leavePolicy.branchId ?? "",
      departmentId: leavePolicy.departmentId ?? "",
      designationId: leavePolicy.designationId ?? "",
      leaveTypeId: leavePolicy.leaveTypeId,
      annualEntitlement: formatAnnualEntitlement(leavePolicy.annualEntitlement),
      carryForwardLimit:
        leavePolicy.carryForwardLimit != null ? String(leavePolicy.carryForwardLimit) : "",
      maxConsecutiveDays:
        leavePolicy.maxConsecutiveDays != null ? String(leavePolicy.maxConsecutiveDays) : "",
      allowNegativeBalance: leavePolicy.allowNegativeBalance,
    });
  }, [leavePolicy, form]);

  const leaveTypeItems = leaveTypes.map((type) => ({
    id: type.id,
    code: type.leaveCode,
    name: type.leaveName,
  }));
  const isCompanyDefault = !branchId;

  return (
    <form id="leave-policy-form" className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel required>Company</RequiredLabel>
          <Controller
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue("branchId", "");
                  form.setValue("departmentId", "");
                  form.setValue("designationId", "");
                  form.setValue("leaveTypeId", "");
                }}
                items={companies}
                loading={companiesLoading}
                clearable={false}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Branch</label>
          <Controller
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <LookupSelect
                value={field.value ?? ""}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue("departmentId", "");
                  form.setValue("designationId", "");
                }}
                items={branches}
                loading={branchesLoading}
                disabled={!companyId}
                clearable
                clearLabel="All branches (company default)"
                placeholder="All branches (company default)"
              />
            )}
          />
          <p className="text-muted-foreground text-xs">
            Leave empty for a company-wide default. Branch overrides still win for employees in that
            branch.
          </p>
          {form.formState.errors.branchId ? (
            <p className="text-destructive text-xs">{form.formState.errors.branchId.message}</p>
          ) : null}
        </div>
      </div>

      {!isCompanyDefault ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Department (optional)</label>
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  items={departments}
                  loading={departmentsLoading}
                  disabled={!branchId}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Designation (optional)</label>
            <Controller
              control={form.control}
              name="designationId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  items={designations}
                  loading={designationsLoading}
                  disabled={!companyId}
                />
              )}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <RequiredLabel required>Leave type</RequiredLabel>
        <Controller
          control={form.control}
          name="leaveTypeId"
          render={({ field }) => (
            <LookupSelect
              value={field.value}
              onChange={field.onChange}
              items={leaveTypeItems}
              loading={leaveTypesLoading}
              disabled={!companyId}
              clearable={false}
            />
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <RequiredLabel required>Leave days per year</RequiredLabel>
          <Input
            type="number"
            step="0.01"
            min="0"
            max={MAX_ANNUAL_ENTITLEMENT}
            placeholder="e.g. 12 or 18.5"
            {...form.register("annualEntitlement")}
          />
          <p className="text-muted-foreground text-xs">
            Decimals allowed. This is the yearly entitlement.
          </p>
          {form.formState.errors.annualEntitlement ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.annualEntitlement.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Carry forward (max days)</label>
          <Input type="number" step="0.5" min="0" {...form.register("carryForwardLimit")} />
          <p className="text-muted-foreground text-xs">
            How many unused days can move into the next year for people on this policy. 0 means
            none. HR sets this; employees do not.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Max consecutive days</label>
          <Input type="number" min="0" {...form.register("maxConsecutiveDays")} />
        </div>
      </div>

      <div className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">Allow balance below zero</p>
          <p className="text-muted-foreground text-xs">
            Off = employee cannot request leave with no days left. On = they may overdraw when
            policy allows it.
          </p>
        </div>
        <Controller
          control={form.control}
          name="allowNegativeBalance"
          render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
        />
      </div>
    </form>
  );
}
