"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useEmployeeDocumentCategories } from "@/features/employee-document-category/hooks/use-employee-document-categories";
import { employeeDocumentCategoryCreateHref } from "@/features/employee-document-category/lib/employee-document-category-navigation";

import {
  employeeDocumentTypeSchema,
  type EmployeeDocumentTypeFormValues,
} from "../validation/employee-document-type-schema";

import type { EmployeeDocumentType } from "../types/employee-document-type";
import { EMPLOYEE_DOCUMENT_TYPE_LIST } from "../lib/employee-document-type-navigation";

interface EmployeeDocumentTypeFormProps {
  documentType?: EmployeeDocumentType | null;
  onSubmit: (data: EmployeeDocumentTypeFormValues) => void;
  isSaving?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onInvalid?: (messages: string[]) => void;
}

export function EmployeeDocumentTypeForm({
  documentType,
  onSubmit,
  onDirtyChange,
  onInvalid,
}: EmployeeDocumentTypeFormProps) {
  const form = useForm<EmployeeDocumentTypeFormValues>({
    resolver: zodResolver(employeeDocumentTypeSchema),
    defaultValues: {
      companyId: "",
      categoryId: "",
      documentCode: "",
      documentName: "",
      description: "",
      requiresExpiry: false,
      requiresDocumentNumber: false,
      requiresVerification: false,
      lifetimeAllowed: false,
      isMandatory: false,
      sortOrder: 0,
      isActive: true,
    },
  });

  const companyId = useWatch({
    control: form.control,
    name: "companyId",
  });

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  const {
    data: categories = [],
    isLoading: categoriesLoading,
  } = useEmployeeDocumentCategories({
    companyId,
  });

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!documentType) {
      form.reset({
        companyId: "",
        categoryId: "",
        documentCode: "",
        documentName: "",
        description: "",
        requiresExpiry: false,
        requiresDocumentNumber: false,
        requiresVerification: false,
        lifetimeAllowed: false,
        isMandatory: false,
        sortOrder: 0,
        isActive: true,
      });
      return;
    }

    form.reset({
      companyId: documentType.companyId,
      categoryId: documentType.categoryId,
      documentCode: documentType.documentCode,
      documentName: documentType.documentName,
      description: documentType.description ?? "",
      requiresExpiry: documentType.requiresExpiry,
      requiresDocumentNumber: documentType.requiresDocumentNumber,
      requiresVerification: documentType.requiresVerification,
      lifetimeAllowed: documentType.lifetimeAllowed,
      isMandatory: documentType.isMandatory,
      sortOrder: documentType.sortOrder,
      isActive: documentType.isActive,
    });
  }, [documentType, form]);

  useEffect(() => {
    if (!documentType && companyId) {
      form.setValue("categoryId", "");
    }
  }, [companyId, documentType, form]);

  const showEmptyCategories =
    Boolean(companyId) && !categoriesLoading && categories.length === 0;

  return (
    <form
      id="employee-document-type-form"
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        const messages = Object.values(errors)
          .map((error) => error?.message)
          .filter((message): message is string => Boolean(message));
        onInvalid?.(messages);
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
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Document Category</RequiredLabel>
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={categories.map((category) => ({
                  id: category.id,
                  code: category.categoryCode,
                  name: category.categoryName,
                }))}
                placeholder="Select Category"
                loading={categoriesLoading}
                disabled={!companyId || showEmptyCategories}
              />
            )}
          />
          {showEmptyCategories ? (
            <p className="text-muted-foreground text-xs">
              No categories for this company yet.{" "}
              <Link
                href={employeeDocumentCategoryCreateHref({
                  returnTo: EMPLOYEE_DOCUMENT_TYPE_LIST,
                })}
                className="text-primary font-medium underline-offset-2 hover:underline"
              >
                Create a category
              </Link>{" "}
              first.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Document Code</RequiredLabel>
          <Input
            {...form.register("documentCode")}
            placeholder="Document Code"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Document Name</RequiredLabel>
          <Input
            {...form.register("documentName")}
            placeholder="Document Name"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Description</RequiredLabel>
          <Input
            {...form.register("description")}
            placeholder="Description"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Sort Order</RequiredLabel>
          <Input
            type="number"
            {...form.register("sortOrder", {
              valueAsNumber: true,
            })}
          />
        </div>
      </MasterFormLayout>

      <div className="grid grid-cols-2 gap-4 rounded-md border p-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...form.register("requiresExpiry")} />
          Requires Expiry
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...form.register("requiresDocumentNumber")}
          />
          Requires Document Number
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...form.register("requiresVerification")}
          />
          Requires Verification
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...form.register("lifetimeAllowed")} />
          Lifetime Allowed
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...form.register("isMandatory")} />
          Mandatory
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" {...form.register("isActive")} />
          Active
        </label>
      </div>
    </form>
  );
}
