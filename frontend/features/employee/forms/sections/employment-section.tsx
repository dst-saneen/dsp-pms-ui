"use client";

import { useMemo } from "react";
import { Controller, UseFormReturn } from "react-hook-form";

import {
  FormSection,
  RequiredLabel,
} from "@/components/forms";

import { LookupSelect } from "@/components/forms/lookup-select";

import { Input } from "@/components/ui/input";

import { useDesignations } from "@/features/lookups/hooks/use-designations";
import { useManagers } from "@/features/lookups/hooks/use-managers";
import type { LookupItem } from "@/features/lookups/types/lookup";

import type { Employee } from "../../types/employee";
import type { EmployeeFormValues } from "../../validation/employee-schema";

const EMPLOYEE_TYPE_OPTIONS = [
  { value: "Permanent", label: "Permanent" },
  { value: "Part-time", label: "Part-time" },
  { value: "Freelance", label: "Freelance" },
  { value: "Other", label: "Other" },
] as const;

interface EmploymentSectionProps {
  form: UseFormReturn<EmployeeFormValues>;
  employee?: Employee | null;
}

function mergeLookupItem(
  items: LookupItem[],
  item?: LookupItem | null,
) {
  if (!item?.id) {
    return items;
  }

  if (items.some((existing) => existing.id === item.id)) {
    return items;
  }

  return [item, ...items];
}

export function EmploymentSection({
  form,
  employee,
}: EmploymentSectionProps) {
  const companyId = form.watch("companyId");
  const employeeType = form.watch("employeeType");

  const {
    data: designations = [],
    isLoading: designationsLoading,
  } = useDesignations(companyId || undefined);

  const {
    data: managers = [],
    isLoading: managersLoading,
  } = useManagers(companyId || undefined);

  const designationItems = useMemo(() => {
    const currentDesignation = employee?.designation
      ? {
          id: employee.designation.id,
          code: employee.designation.designationCode,
          name: employee.designation.designationName,
        }
      : null;

    return mergeLookupItem(designations, currentDesignation);
  }, [designations, employee]);

  const managerItems = useMemo(() => {
    const currentManager = employee?.manager
      ? {
          id: employee.manager.id,
          code: employee.manager.employeeCode,
          name: `${employee.manager.firstName} ${employee.manager.lastName ?? ""}`.trim(),
        }
      : null;

    return mergeLookupItem(managers, currentManager).filter(
      (item) => item.id !== employee?.id,
    );
  }, [managers, employee]);

  const employeeTypeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> =
      EMPLOYEE_TYPE_OPTIONS.map((option) => ({ ...option }));
    const current = employeeType?.trim();
    if (current && !options.some((option) => option.value === current)) {
      options.push({ value: current, label: current });
    }
    return options;
  }, [employeeType]);

  return (
    <FormSection title="Employment">
      <div className="grid gap-4 md:grid-cols-2">

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-designation">
            Designation
          </RequiredLabel>

          <Controller
            control={form.control}
            name="designationId"
            render={({ field }) => (
              <LookupSelect
                id="employee-designation"
                value={field.value ?? ""}
                onChange={field.onChange}
                items={designationItems}
                placeholder={
                  companyId
                    ? "Select Designation"
                    : "Select Company First"
                }
                loading={designationsLoading}
                disabled={!companyId}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-reporting-manager">
            Reporting Manager
          </RequiredLabel>

          <Controller
            control={form.control}
            name="managerId"
            render={({ field }) => (
              <LookupSelect
                id="employee-reporting-manager"
                value={field.value ?? ""}
                onChange={field.onChange}
                items={managerItems}
                placeholder={
                  companyId
                    ? "Select Reporting Manager"
                    : "Select Company First"
                }
                loading={managersLoading}
                disabled={!companyId}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-type">
            Employee Type
          </RequiredLabel>

          <Input
            id="employee-type"
            list="employee-type-options"
            placeholder="Employee Type"
            {...form.register("employeeType")}
          />
          <datalist id="employee-type-options">
            {employeeTypeOptions.map((option) => (
              <option key={option.value} value={option.value} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-joining-date">
            Joining Date
          </RequiredLabel>

          <Input
            id="employee-joining-date"
            type="date"
            {...form.register("joiningDate")}
          />
        </div>

      </div>
    </FormSection>
  );
}
