"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { BranchForm } from "../forms/branch-form";
import { useCreateBranch } from "../hooks/use-create-branch";
import { useDeleteBranch } from "../hooks/use-delete-branch";
import { useUpdateBranch } from "../hooks/use-update-branch";
import {
  BRANCH_LIST,
  branchWorkingDaysHref,
} from "../lib/branch-navigation";
import type { Branch } from "../types/branch";
import {
  toBranchPayload,
  type BranchFormValues,
} from "../validation/branch-schema";

interface BranchEditorProps {
  mode: "create" | "edit";
  branch?: Branch | null;
  returnTo: string;
  canManage: boolean;
  defaultCompanyId?: string;
}

export function BranchEditor({
  mode,
  branch = null,
  returnTo,
  canManage,
  defaultCompanyId,
}: BranchEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateBranch({ suppressToast: true });
  const updateMutation = useUpdateBranch({ suppressToast: true });
  const deleteMutation = useDeleteBranch();
  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Branch"
          : branch
            ? `${branch.branchCode} ${branch.branchName}`
            : "Edit Branch",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: BranchFormValues) => {
    setValidationErrors([]);
    const payload = toBranchPayload(data);

    if (mode === "edit" && branch) {
      updateMutation.mutate(
        { id: branch.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Branch updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(getApiErrorMessage(error, "Unable to update Branch."));
          },
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: (created) => {
        toast.success("Branch created successfully.", {
          action: {
            label: "Configure working days",
            onClick: () => router.push(branchWorkingDaysHref(created.id)),
          },
        });
        router.push(branchWorkingDaysHref(created.id));
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Branch."));
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Branch"
            : `Edit ${branch?.branchName ?? "Branch"}`
        }
        description={
          mode === "create"
            ? "Choose the company first, then create the operating location. Working days are configured as a follow-up step."
            : "Update branch master details. Working days stay on a separate configuration sheet."
        }
        formId="branch-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(branch)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
        headerActions={
          mode === "edit" && branch ? (
            <Button type="button" variant="outline" asChild>
              <Link href={branchWorkingDaysHref(branch.id)}>
                Configure working days
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <BranchForm
            branch={branch}
            defaultCompanyId={defaultCompanyId}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />
        </div>
      </EntityFormPage>

      {branch ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Branch"
          name={branch.branchName}
          code={branch.branchCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(branch.id, {
              onSuccess: () => {
                router.push(BRANCH_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
