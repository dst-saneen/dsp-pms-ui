"use client";

import { useEffect } from "react";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  employeeDocumentCategorySchema,
  type EmployeeDocumentCategoryFormValues,
} from "../validation/employee-document-category-schema";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";

import { useCompanies } from "@/features/lookups/hooks/use-companies";

interface EmployeeDocumentCategoryFormProps {
  category?: EmployeeDocumentCategory | null;
  onSubmit: (data: EmployeeDocumentCategoryFormValues) => void;
  isSaving?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onInvalid?: (messages: string[]) => void;
}

export function EmployeeDocumentCategoryForm({
  category,
  onSubmit,
  onDirtyChange,
  onInvalid,
}: EmployeeDocumentCategoryFormProps) {
  const form = useForm<EmployeeDocumentCategoryFormValues>({
    resolver: zodResolver(employeeDocumentCategorySchema),
    defaultValues: {
      companyId: "",
      categoryCode: "",
      categoryName: "",
      description: "",
      sortOrder: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!category) {
      form.reset({
        companyId: "",
        categoryCode: "",
        categoryName: "",
        description: "",
        sortOrder: 0,
        isActive: true,
      });
      return;
    }

    form.reset({
      companyId: category.companyId,
      categoryCode: category.categoryCode,
      categoryName: category.categoryName,
      description: category.description ?? "",
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
  }, [category, form]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  return (
    <form
      id="employee-document-category-form"
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
                loading={companiesLoading}
                placeholder="Select Company"
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Category Code</RequiredLabel>
          <Input
            {...form.register("categoryCode")}
            placeholder="Category Code"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Category Name</RequiredLabel>
          <Input
            {...form.register("categoryName")}
            placeholder="Category Name"
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
    </form>
  );
}
