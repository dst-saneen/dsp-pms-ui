"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import {
  assetCategorySchema,
  type AssetCategoryFormValues,
} from "../validation/asset-category-schema";
import type { AssetCategory } from "../types/asset-category";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MasterFormLayout,
  RequiredLabel,
  LookupSelect,
} from "@/components/forms";

interface AssetCategoryFormProps {
  assetCategory?: AssetCategory | null;
  onSubmit: (data: AssetCategoryFormValues) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function AssetCategoryForm({
  assetCategory,
  onSubmit,
}: AssetCategoryFormProps) {
  const form = useForm<AssetCategoryFormValues>({
    resolver: zodResolver(assetCategorySchema),
    defaultValues: {
      companyId: "",
      assetCategoryName: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!assetCategory) {
      form.reset({
        companyId: "",
        assetCategoryName: "",
        description: "",
      });
      return;
    }

    form.reset({
      companyId: assetCategory.companyId,
      assetCategoryName: assetCategory.assetCategoryName,
      description: assetCategory.description ?? "",
    });
  }, [assetCategory, form]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  return (
    <form
      id="asset-category-form"
      onSubmit={form.handleSubmit(onSubmit)}
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
                disabled={Boolean(assetCategory)}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Category Name</RequiredLabel>
          <Input
            {...form.register("assetCategoryName")}
            placeholder="Category Name"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>Description</RequiredLabel>
          <Textarea
            rows={3}
            {...form.register("description")}
            placeholder="Description"
          />
        </div>
      </MasterFormLayout>
    </form>
  );
}
