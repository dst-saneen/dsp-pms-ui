"use client";

import { Controller, UseFormReturn } from "react-hook-form";

import { LookupSelect } from "@/components/forms/lookup-select";

import {
  FormSection,
  RequiredLabel,
} from "@/components/forms";

import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useDepartments } from "@/features/lookups/hooks/use-departments";

import type { LookupItem } from "@/features/lookups/types/lookup";
import type { EmployeeFormValues } from "../../validation/employee-schema";

interface OrganizationSectionProps {
  form: UseFormReturn<EmployeeFormValues>;
  companies: LookupItem[];
  companiesLoading: boolean;
}

export function OrganizationSection({
  form,
  companies,
  companiesLoading,
}: OrganizationSectionProps) {
  const companyId = form.watch("companyId");
  const branchId = form.watch("branchId");

  const {
    data: branches = [],
    isLoading: branchesLoading,
  } = useBranches(companyId);

  const {
    data: departments = [],
    isLoading: departmentsLoading,
  } = useDepartments(branchId, { enabled: Boolean(branchId) });

  return (
    <FormSection title="Organization">
      <div className="grid gap-4 md:grid-cols-2">

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-company" required>
            Company
          </RequiredLabel>

          <Controller
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <LookupSelect
                id="employee-company"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);

                  form.setValue("branchId", "");
                  form.setValue("departmentId", "");
                  form.setValue("designationId", "");
                  form.setValue("managerId", "");
                }}
                items={companies}
                placeholder="Select Company"
                loading={companiesLoading}
              />
            )}
          />
          {form.formState.errors.companyId?.message ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.companyId.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-branch" required>
            Branch
          </RequiredLabel>

          <Controller
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <LookupSelect
                id="employee-branch"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);

                  form.setValue("departmentId", "");
                  form.setValue("designationId", "");
                  form.setValue("managerId", "");
                }}
                items={branches}
                placeholder={
                  companyId
                    ? "Select Branch"
                    : "Select Company First"
                }
                loading={branchesLoading}
                disabled={!companyId}
              />
            )}
          />
          {form.formState.errors.branchId?.message ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.branchId.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-department" required>
            Department
          </RequiredLabel>

          <Controller
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <LookupSelect
                id="employee-department"
                value={field.value}
                onChange={field.onChange}
                items={departments}
                placeholder={
                  branchId
                    ? "Select Department"
                    : "Select Branch First"
                }
                loading={departmentsLoading}
                disabled={!branchId}
              />
            )}
          />
          {form.formState.errors.departmentId?.message ? (
            <p className="text-destructive text-xs">
              {form.formState.errors.departmentId.message}
            </p>
          ) : null}
        </div>

      </div>
    </FormSection>
  );
}
