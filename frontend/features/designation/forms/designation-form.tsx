"use client";

import { useEffect } from "react";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  designationSchema,
  type DesignationFormValues,
} from "../validation/designation-schema";

import {
  getDesignationOnboardingBranchId,
  getDesignationOnboardingDepartmentIds,
  type Designation,
} from "../types/designation";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useBranches } from "@/features/lookups/hooks/use-branches";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { useAuth } from "@/providers/auth-provider";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { cn } from "@/lib/utils";

interface DesignationFormProps {
  designation?: Designation | null;

  onSubmit: (data: DesignationFormValues) => void;

  onCancel?: () => void;

  isSaving?: boolean;

  onDirtyChange?: (isDirty: boolean) => void;

  onInvalid?: (messages: string[]) => void;
}

function flattenFormErrors(
  errors: Record<string, { message?: string } | undefined>,
): string[] {
  const messages: string[] = [];
  for (const value of Object.values(errors)) {
    if (value?.message) messages.push(String(value.message));
  }
  return messages;
}

export function DesignationForm({
  designation,
  onSubmit,
  onDirtyChange,
  onInvalid,
}: DesignationFormProps) {
  const { hasPermission } = useAuth();
  const { data: capabilities } = useModuleCapabilities();

  const canLinkOnboarding =
    Boolean(capabilities?.onboardingNav) &&
    hasPermission("hr.onboarding.manage");

  const form = useForm<DesignationFormValues>({
    resolver: zodResolver(designationSchema),
    defaultValues: {
      companyId: "",
      designationName: "",
      level: undefined,
      isActive: true,
      departmentId: "",
      branchId: "",
      onboardingInvolvementDepartmentIds: [],
    },
  });

  const companyId = useWatch({ control: form.control, name: "companyId" });
  const departmentId = useWatch({ control: form.control, name: "departmentId" });
  const branchId = useWatch({ control: form.control, name: "branchId" });
  const isActive = useWatch({ control: form.control, name: "isActive" });

  useEffect(() => {
    if (!designation) {
      form.reset({
        companyId: "",
        designationName: "",
        level: undefined,
        isActive: true,
        departmentId: "",
        branchId: "",
        onboardingInvolvementDepartmentIds: [],
      });
      return;
    }

    form.reset({
      companyId: designation.companyId,
      designationName: designation.designationName,
      level: designation.level,
      isActive: designation.isActive ?? true,
      departmentId: designation.departmentId ?? "",
      branchId: getDesignationOnboardingBranchId(designation) ?? "",
      onboardingInvolvementDepartmentIds:
        getDesignationOnboardingDepartmentIds(designation),
    });
  }, [designation, form]);

  useEffect(() => {
    if (designation) return;
    form.setValue("departmentId", "");
    form.setValue("branchId", "");
    form.setValue("onboardingInvolvementDepartmentIds", []);
  }, [companyId, designation, form]);

  useEffect(() => {
    if (designation) return;
    form.setValue("onboardingInvolvementDepartmentIds", []);
  }, [branchId, designation, form]);

  useEffect(() => {
    if (isActive || designation) return;
    form.setValue("onboardingInvolvementDepartmentIds", []);
  }, [designation, isActive, form]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  const { data: branches = [], isLoading: branchesLoading } = useBranches(
    companyId || undefined,
  );

  const {
    data: homeDepartments = [],
    isLoading: homeDepartmentsLoading,
  } = useDepartments(undefined, {
    companyId: companyId || undefined,
    enabled: Boolean(companyId),
  });

  const {
    data: departments = [],
    isLoading: departmentsLoading,
  } = useDepartments(branchId || undefined, {
    companyId: companyId || undefined,
    enabled: Boolean(companyId && branchId && canLinkOnboarding),
  });

  const showOnboardingSection = canLinkOnboarding;
  const onboardingDisabled =
    !companyId || !branchId || !isActive || departmentsLoading;

  const homeDepartmentBranchId = homeDepartments.find(
    (department) => department.id === departmentId,
  )?.branchId;
  const showBranchMismatchWarning = Boolean(
    departmentId &&
      branchId &&
      homeDepartmentBranchId &&
      homeDepartmentBranchId !== branchId,
  );

  return (
    <form
      id="designation-form"
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        const messages = flattenFormErrors(
          errors as Record<string, { message?: string } | undefined>,
        );
        onInvalid?.(
          messages.length > 0
            ? messages
            : ["Please fix the highlighted fields before saving."],
        );
      })}
      className="space-y-6"
    >
      <MasterFormLayout>
        <div className="space-y-2">
          <RequiredLabel required>Company</RequiredLabel>
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
                disabled={Boolean(designation)}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Designation Name</RequiredLabel>
          <Input
            {...form.register("designationName")}
            placeholder="Designation Name"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Level</RequiredLabel>
          <Input
            type="number"
            {...form.register("level", { valueAsNumber: true })}
            placeholder="Level"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>Belongs to Department</RequiredLabel>
          <Controller
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <LookupSelect
                value={field.value ?? ""}
                onChange={field.onChange}
                items={homeDepartments}
                placeholder={
                  companyId
                    ? "Select Department (optional)"
                    : "Select a company first"
                }
                loading={homeDepartmentsLoading}
                disabled={!companyId}
                clearable
              />
            )}
          />
          <p className="text-muted-foreground text-xs">
            Home department for this designation in the org chart. Separate from
            onboarding involvement departments below.
          </p>
        </div>

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
              Enable this designation. Onboarding departments can only be linked
              while active.
            </span>
          </div>
        </div>

        {showOnboardingSection ? (
          <>
            <div className="space-y-2">
              <RequiredLabel>Branch (for onboarding)</RequiredLabel>
              <Controller
                control={form.control}
                name="branchId"
                render={({ field }) => (
                  <LookupSelect
                    value={field.value ?? ""}
                    onChange={(value) => {
                      field.onChange(value);
                      form.setValue("onboardingInvolvementDepartmentIds", []);
                    }}
                    items={branches}
                    placeholder={
                      companyId ? "Select Branch" : "Select a company first"
                    }
                    loading={branchesLoading}
                    disabled={!companyId || !isActive}
                  />
                )}
              />
              {form.formState.errors.branchId ? (
                <p className="text-destructive text-xs">
                  {form.formState.errors.branchId.message}
                </p>
              ) : null}
              {showBranchMismatchWarning ? (
                <p className="text-amber-700 dark:text-amber-400 text-xs">
                  Home department Branch differs from the selected onboarding
                  Branch. You can still save; onboarding slices stay on the
                  onboarding Branch.
                </p>
              ) : null}
            </div>

            <div className="space-y-2 md:col-span-2">
              <RequiredLabel>Onboarding Involvement Departments</RequiredLabel>
              <Controller
                control={form.control}
                name="onboardingInvolvementDepartmentIds"
                render={({ field }) => {
                  const selected = new Set(field.value ?? []);
                  const disabled = onboardingDisabled;
                  const allSelected =
                    departments.length > 0 &&
                    departments.every((department) =>
                      selected.has(department.id),
                    );
                  const someSelected = selected.size > 0 && !allSelected;

                  function toggle(departmentId: string) {
                    if (disabled) return;
                    const next = new Set(selected);
                    if (next.has(departmentId)) {
                      next.delete(departmentId);
                    } else {
                      next.add(departmentId);
                    }
                    field.onChange([...next]);
                  }

                  function toggleAll() {
                    if (disabled) return;
                    field.onChange(
                      allSelected
                        ? []
                        : departments.map((department) => department.id),
                    );
                  }

                  return (
                    <div
                      className={cn(
                        "max-h-48 space-y-1 overflow-y-auto rounded-md border p-2",
                        disabled && "bg-muted/40 opacity-70",
                      )}
                      role="group"
                      aria-label="Onboarding involvement departments"
                    >
                      {!companyId ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">
                          Select a company first
                        </p>
                      ) : !isActive ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">
                          Activate the designation to link onboarding
                          departments.
                        </p>
                      ) : !branchId ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">
                          Select a Branch to list departments for that Branch
                          only.
                        </p>
                      ) : departmentsLoading ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">
                          Loading departments…
                        </p>
                      ) : departments.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-3 text-sm">
                          No departments found for this Branch. Create them
                          under Departments first.
                        </p>
                      ) : (
                        <>
                          <label
                            className={cn(
                              "hover:bg-muted/60 flex cursor-pointer items-center gap-3 rounded-md border-b px-2 py-2 text-sm font-medium",
                              allSelected && "bg-muted/50",
                            )}
                          >
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={allSelected}
                              disabled={disabled}
                              ref={(input) => {
                                if (!input) return;
                                input.indeterminate = someSelected;
                              }}
                              onChange={toggleAll}
                            />
                            <span>Select all</span>
                          </label>

                          {departments.map((department) => {
                            const checked = selected.has(department.id);
                            const label = department.code
                              ? `${department.code} - ${department.name}`
                              : department.name;

                            return (
                              <label
                                key={department.id}
                                className={cn(
                                  "hover:bg-muted/60 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm",
                                  checked && "bg-muted/50",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 accent-primary"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggle(department.id)}
                                />
                                <span>{label}</span>
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                }}
              />

              <p className="text-muted-foreground text-xs">
                Departments must share one Branch. Selected departments get
                onboarding checklists; add tasks in Onboarding Templates.
              </p>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground md:col-span-2 text-sm">
            Onboarding involvement is hidden because Onboarding is off for this
            scope or you lack{" "}
            <span className="font-medium">hr.onboarding.manage</span>.
          </div>
        )}
      </MasterFormLayout>
    </form>
  );
}
