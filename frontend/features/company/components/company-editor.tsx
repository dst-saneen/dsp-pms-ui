"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { Button } from "@/components/ui/button";

import { CompanyForm } from "../forms/company-form";
import { useCreateCompany } from "../hooks/use-create-company";
import { useDeleteCompany } from "../hooks/use-delete-company";
import { useUpdateCompany } from "../hooks/use-update-company";
import { COMPANY_LIST, companyModulesHref } from "../lib/company-navigation";
import type { Company } from "../types/company";
import type { CompanyFormValues } from "../validation/company-schema";

interface CompanyEditorProps {
  mode: "create" | "edit";
  company?: Company | null;
  returnTo: string;
  canManage: boolean;
}

export function CompanyEditor({
  mode,
  company = null,
  returnTo,
  canManage,
}: CompanyEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const createMutation = useCreateCompany({ suppressToast: true });
  const updateMutation = useUpdateCompany({ suppressToast: true });
  const deleteMutation = useDeleteCompany();

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Company"
          : company
            ? `${company.companyCode} ${company.companyName}`
            : "Edit Company",
      href: null,
    },
  ]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const handleSubmit = (data: CompanyFormValues) => {
    setValidationErrors([]);
    const dto = {
      ...data,
      companyGroupId: data.companyGroupId || undefined,
      parentCompanyId: data.parentCompanyId || undefined,
    };

    if (mode === "edit" && company) {
      updateMutation.mutate(
        { id: company.id, data: dto },
        {
          onSuccess: () => {
            toast.success("Company updated successfully.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(getApiErrorMessage(error, "Unable to update Company."));
          },
        },
      );
      return;
    }

    createMutation.mutate(dto, {
      onSuccess: () => {
        toast.success("Company created successfully.", {
          action: {
            label: "Add branch",
            onClick: () => router.push("/administration/branches/new"),
          },
        });
        router.push(returnTo);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create Company."));
      },
    });
  };

  return (
    <>
      <EntityFormPage
        title={
          mode === "create"
            ? "Create Company"
            : `Edit ${company?.companyName ?? "Company"}`
        }
        description={
          mode === "create"
            ? "Create a company under a Company Group. Branches and departments come next."
            : "Update company profile details. Destructive status changes stay confirmed."
        }
        formId="company-form"
        primaryLabel={mode === "edit" ? "Update" : "Save"}
        secondaryLabel="Cancel"
        onSecondary={goBack}
        isSaving={isSaving}
        showDelete={mode === "edit" && canManage && Boolean(company)}
        onDelete={() => setDeleteOpen(true)}
        isDeleting={deleteMutation.isPending}
        headerActions={
          mode === "edit" && company ? (
            <Button type="button" variant="outline" asChild>
              <Link href={companyModulesHref(company.id)}>
                Modules &amp; Features
              </Link>
            </Button>
          ) : null
        }
      >
        <div className="space-y-4">
          <FormValidationSummary errors={validationErrors} />
          <CompanyForm
            company={company}
            onSubmit={handleSubmit}
            isSaving={isSaving}
            onDirtyChange={setIsDirty}
            onInvalid={setValidationErrors}
          />
        </div>
      </EntityFormPage>

      {company ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete Company"
          name={company.companyName}
          code={company.companyCode}
          loading={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(company.id, {
              onSuccess: () => {
                router.push(COMPANY_LIST);
              },
            })
          }
        />
      ) : null}
    </>
  );
}
