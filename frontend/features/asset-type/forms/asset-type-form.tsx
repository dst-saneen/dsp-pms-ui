"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import {
  assetTypeSchema,
  type AssetTypeFormValues,
} from "../validation/asset-type-schema";
import type { AssetType } from "../types/asset-type";
import { useAssetCategories } from "@/features/asset-category/hooks/use-asset-categories";
import {
  ASSET_KIND_LABELS,
  ASSET_KINDS,
  ASSET_TRACKING_LABELS,
  defaultTrackingMode,
  trackingModesForKind,
  type AssetKind,
} from "@/features/asset/lib/kind-tracking";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormSection,
  RequiredLabel,
  LookupSelect,
} from "@/components/forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssetTypeFormProps {
  assetType?: AssetType | null;
  onSubmit: (data: AssetTypeFormValues) => void;
  onCancel?: () => void;
  isSaving?: boolean;
}

export function AssetTypeForm({ assetType, onSubmit }: AssetTypeFormProps) {
  const form = useForm<AssetTypeFormValues>({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: {
      companyId: "",
      assetCategoryId: "",
      assetTypeName: "",
      description: "",
      kind: "GENERAL",
      trackingMode: "LOCATION",
    },
  });

  useEffect(() => {
    if (!assetType) {
      form.reset({
        companyId: "",
        assetCategoryId: "",
        assetTypeName: "",
        description: "",
        kind: "GENERAL",
        trackingMode: "LOCATION",
      });
      return;
    }

    form.reset({
      companyId: assetType.companyId,
      assetCategoryId: assetType.assetCategoryId,
      assetTypeName: assetType.assetTypeName,
      description: assetType.description ?? "",
      kind: assetType.kind,
      trackingMode: assetType.trackingMode,
    });
  }, [assetType, form]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const { data: categoryPage, isLoading: assetCategoriesLoading } =
    useAssetCategories();
  const assetCategories = categoryPage?.items ?? [];
  const companyId = useWatch({ control: form.control, name: "companyId" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const classificationLocked = Boolean(
    assetType && assetType.classificationMutable === false,
  );

  const assetCategoryItems = assetCategories
    .filter((category) => category.companyId === companyId)
    .map((category) => ({
      id: category.id,
      code: category.assetCategoryCode,
      name: category.assetCategoryName,
    }));

  const trackingOptions = trackingModesForKind(kind);

  useEffect(() => {
    if (!kind) {
      return;
    }

    const allowed = trackingModesForKind(kind);
    const current = form.getValues("trackingMode");
    if (!allowed.includes(current)) {
      form.setValue("trackingMode", allowed[0] ?? "INDIVIDUAL", {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [form, kind]);

  return (
    <form
      id="asset-type-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <FormSection title="General Information">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel required>Company</RequiredLabel>
            <Controller
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("assetCategoryId", "");
                  }}
                  items={companies}
                  placeholder="Select Company"
                  loading={companiesLoading}
                  disabled={Boolean(assetType)}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <RequiredLabel required>Asset Category</RequiredLabel>
            <Controller
              control={form.control}
              name="assetCategoryId"
              render={({ field }) => (
                <LookupSelect
                  value={field.value}
                  onChange={field.onChange}
                  items={assetCategoryItems}
                  placeholder="Select Asset Category"
                  loading={assetCategoriesLoading}
                />
              )}
            />
            {!assetCategoriesLoading &&
            companyId &&
            assetCategoryItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No categories for this company.{" "}
                <Link
                  href="/asset-management/asset-categories"
                  className="text-primary underline"
                >
                  Create a category
                </Link>{" "}
                first (step 1), then create the type here.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel required>Type Name</RequiredLabel>
            <Input {...form.register("assetTypeName")} placeholder="Type Name" />
          </div>

          <div className="space-y-2">
            <RequiredLabel required>Kind</RequiredLabel>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={classificationLocked}
                  onValueChange={(value) => {
                    const nextKind = value as AssetKind;
                    field.onChange(nextKind);
                    form.setValue("trackingMode", defaultTrackingMode(nextKind));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select kind" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSET_KINDS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {ASSET_KIND_LABELS[item]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <RequiredLabel required>Tracking</RequiredLabel>
            <Controller
              control={form.control}
              name="trackingMode"
              render={({ field }) => {
                const value = trackingOptions.includes(field.value)
                  ? field.value
                  : trackingOptions[0];

                return (
                  <Select
                    key={kind}
                    value={value}
                    disabled={classificationLocked || trackingOptions.length === 1}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select tracking" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackingOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {ASSET_TRACKING_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }}
            />
            {form.formState.errors.trackingMode ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.trackingMode.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {kind === "SOFTWARE_LICENSE"
                  ? "Seat pool means shared software licences, not a physical item."
                  : kind === "HARDWARE" || kind === "CARD"
                    ? "This kind is always one physical item per assignment."
                    : "Location = a room or area. One item = a named physical asset."}
              </p>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <RequiredLabel>Description</RequiredLabel>
            <Textarea
              rows={4}
              {...form.register("description")}
              placeholder="Description"
            />
          </div>
        </div>
      </FormSection>
    </form>
  );
}
