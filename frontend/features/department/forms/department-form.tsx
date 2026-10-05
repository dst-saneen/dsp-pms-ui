"use client";

import { useEffect, useRef } from "react";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  departmentSchema,
  type DepartmentFormValues,
} from "../validation/department-schema";

import type { Department } from "../types/department";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useBranches } from "@/features/branch/hooks/use-branches";

interface DepartmentFormProps {
  department?: Department | null;

  onSubmit: (
    data: DepartmentFormValues,
  ) => void;

  onCancel?: () => void;

  isSaving?: boolean;

  defaultCompanyId?: string;

  defaultBranchId?: string;

  onDirtyChange?: (isDirty: boolean) => void;

  onInvalid?: (messages: string[]) => void;
}

export function DepartmentForm({
  department,
  onSubmit,
  defaultCompanyId,
  defaultBranchId,
  onDirtyChange,
  onInvalid,
}: DepartmentFormProps) {
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),

    defaultValues: {
      companyId: defaultCompanyId ?? "",
      branchId: defaultBranchId ?? "",
      departmentName: "",
      isActive: true,
    },
  });

  const companyId = useWatch({
    control: form.control,
    name: "companyId",
  });

  const {
    data: companies = [],
    isLoading: companiesLoading,
  } = useCompanies();

  const {
    data: branches = [],
    isLoading: branchesLoading,
  } = useBranches(companyId || undefined);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!department) {
      form.reset({
        companyId: defaultCompanyId ?? "",
        branchId: defaultBranchId ?? "",
        departmentName: "",
        isActive: true,
      });

      return;
    }

    form.reset({
      companyId: department.companyId,
      branchId: department.branchId,
      departmentName: department.departmentName,
      isActive: department.isActive ?? true,
    });
  }, [department, defaultBranchId, defaultCompanyId, form]);

  const previousCompanyIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (department) return;
    if (previousCompanyIdRef.current === undefined) {
      previousCompanyIdRef.current = companyId;
      return;
    }
    if (previousCompanyIdRef.current !== companyId) {
      form.setValue("branchId", "");
      previousCompanyIdRef.current = companyId;
    }
  }, [companyId, department, form]);

  return (
    <form
      id="department-form"
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        const messages = Object.values(errors)
          .map((error) => error?.message)
          .filter((message): message is string => Boolean(message));
        onInvalid?.(messages);
      })}
      className="space-y-6"
    >
      <MasterFormLayout>

        {/* Company */}
        <div className="space-y-2">
          <RequiredLabel required>
            Company
          </RequiredLabel>

          <Controller
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={companies}
                placeholder="Select Company"
                loading={companiesLoading}
              />
            )}
          />
        </div>

        {/* Branch */}
        <div className="space-y-2">
          <RequiredLabel required>
            Branch
          </RequiredLabel>

          <Controller
            control={form.control}
            name="branchId"
            render={({ field }) => (
             <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={branches.map((branch) => ({
                    id: branch.id,
                    code: branch.branchCode,
                    name: branch.branchName,
                }))}
                placeholder="Select Branch"
                loading={branchesLoading}
                disabled={!companyId}
                />
            )}
          />
        </div>

        {/* Department Name */}
        <div className="space-y-2">
          <RequiredLabel required>
            Department Name
          </RequiredLabel>

          <Input
            {...form.register("departmentName")}
            placeholder="Department Name"
          />
        </div>

        {/* Active */}
        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>Active</RequiredLabel>

          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            <span className="text-sm text-muted-foreground">
              Enable this department
            </span>
          </div>
        </div>

      </MasterFormLayout>
    </form>
  );
}
