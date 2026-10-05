"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { DepartmentForm } from "../forms/department-form";
import { useCreateDepartment } from "../hooks/use-create-department";
import { useDeleteDepartment } from "../hooks/use-delete-department";
import { useUpdateDepartment } from "../hooks/use-update-department";
import { DEPARTMENT_LIST } from "../lib/department-navigation";
import type { Department } from "../types/department";
import type { DepartmentFormValues } from "../validation/department-schema";

interface DepartmentEditorProps {
  mode: "create" | "edit";
  department?: Department | null;
  returnTo: string;
  canManage: boolean;
  defaultCompanyId?: string;
  defaultBranchId?: string;
}

export function DepartmentEditor({
  mode,
  department = null,
  returnTo,
  canManage,
  defaultCompanyId,
  defaultBranchId,
}: DepartmentEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateDepartment({ suppressToast: true });
  const updateMutation = useUpdateDepartment({ suppressToast: true });
  const deleteMutation = useDeleteDepartment();
  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Department"
          : department
            ? `${department.departmentCode} ${department.departmentName}`
            : "Edit Department",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: DepartmentFormValues) => {
    setValidationErrors([]);

    if (mode === "edit" && department) {
      updateMutation.mutate(
        { id: department.id, data },
        {
          onSuccess: () => {
            toast.success("Department updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update Department."),
            );
          },
        },
      );
      return;
    }

    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Department created successfully.");
        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Department."));
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Department"
            : `Edit ${department?.departmentName ?? "Department"}`
        }
        description={
          mode === "create"
            ? "Select Company, then Branch. Only in-scope branches are available, and changing company resets the branch."
            : "Update department details within the selected company and branch scope."
        }
        formId="department-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(department)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <DepartmentForm
            department={department}
            defaultCompanyId={defaultCompanyId}
            defaultBranchId={defaultBranchId}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />
        </div>
      </EntityFormPage>

      {department ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Department"
          name={department.departmentName}
          code={department.departmentCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(department.id, {
              onSuccess: () => {
                router.push(DEPARTMENT_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
