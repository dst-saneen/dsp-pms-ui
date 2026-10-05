"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { assetSchema } from "../validation/asset-schema";
import type { AssetFormValues } from "../validation/asset-schema";
import type { Asset } from "../types/asset";
import { ASSET_KIND_LABELS, defaultTrackingMode, isPhysicalAssetKind, isSoftwareLicenseKind } from "../lib/kind-tracking";
import type { AssetCatalog } from "../lib/kind-tracking";

import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { useAssetCategories } from "@/features/asset-category/hooks/use-asset-categories";
import { useAssetTypes } from "@/features/asset-type/hooks/use-asset-types";
import { useAssetDepartments } from "../hooks/use-asset-inbox";

import { FormSection, TransactionFormLayout, LookupSelect, RequiredLabel } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}

interface AssetFormProps {
  asset?: Asset | null;
  onSubmit: (data: AssetFormValues) => void;
  onCancel?: () => void;
  isSaving?: boolean;
  catalog?: AssetCatalog;
}

const emptyValues: AssetFormValues = {
  isEdit: false,
  companyId: "",
  departmentId: "",
  assetCategoryId: "",
  assetTypeId: "",
  assetName: "",
  kind: undefined,
  trackingMode: undefined,
  serialNumber: "",
  manufacturer: "",
  modelNumber: "",
  purchaseDate: "",
  purchaseCost: undefined,
  currency: "",
  warrantyExpiry: "",
  location: "",
  remarks: "",
  cardNumber: "",
  cardIssuer: "",
  cardAccessZone: "",
  cardIssuedDate: "",
  cardExpiryDate: "",
  vendorName: "",
  productName: "",
  contractReference: "",
  vaultReference: "",
  licenseStartsOn: "",
  licenseExpiresOn: "",
  licenseRenewsOn: "",
  seatCapacity: undefined,
};

export function AssetForm({
  asset,
  onSubmit,
  catalog = "PHYSICAL",
}: AssetFormProps) {
  const editing = Boolean(asset);
  const form = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema) as Resolver<AssetFormValues>,
    defaultValues: emptyValues,
  });

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const companyId = useWatch({ control: form.control, name: "companyId" });
  const selectedCategoryId = useWatch({
    control: form.control,
    name: "assetCategoryId",
  });
  const selectedTypeId = useWatch({
    control: form.control,
    name: "assetTypeId",
  });
  const kind = useWatch({ control: form.control, name: "kind" });
  const trackingMode = useWatch({ control: form.control, name: "trackingMode" });

  const { data: grantedDepartments = [] } = useAssetDepartments();
  const { data: companyDepartments = [], isLoading: departmentsLoading } =
    useDepartments(undefined, {
      companyId: companyId || undefined,
      enabled: Boolean(companyId),
    });
  const { data: categoryPage, isLoading: assetCategoriesLoading } =
    useAssetCategories();
  const { data: typePage, isLoading: assetTypesLoading } = useAssetTypes();

  const assetCategories = categoryPage?.items ?? [];
  const assetTypes = typePage?.items ?? [];

  const departmentItems =
    grantedDepartments.length > 0
      ? grantedDepartments
          .filter((department) =>
            companyId ? department.company?.id === companyId : true,
          )
          .map((department) => ({
            id: department.id,
            code: department.code,
            name: department.name,
          }))
      : companyDepartments;

  const assetCategoryItems = assetCategories
    .filter((category) => category.companyId === companyId)
    .map((category) => ({
      id: category.id,
      code: category.assetCategoryCode,
      name: category.assetCategoryName,
    }));

  const assetTypeItems = assetTypes
    .filter((type) => type.assetCategoryId === selectedCategoryId)
    .filter((type) =>
      catalog === "LICENSE"
        ? isSoftwareLicenseKind(type.kind)
        : isPhysicalAssetKind(type.kind),
    )
    .map((type) => ({
      id: type.id,
      code: type.assetTypeCode,
      name: `${type.assetTypeName} (${ASSET_KIND_LABELS[type.kind] ?? type.kind})`,
    }));

  const selectedType = assetTypes.find((type) => type.id === selectedTypeId);

  useEffect(() => {
    if (!selectedType) {
      return;
    }
    form.setValue("kind", selectedType.kind, { shouldDirty: true });
    form.setValue(
      "trackingMode",
      selectedType.trackingMode ?? defaultTrackingMode(selectedType.kind),
      { shouldDirty: true },
    );
  }, [form, selectedType]);

  useEffect(() => {
    if (!asset) {
      form.reset(emptyValues);
      return;
    }

    form.reset({
      ...emptyValues,
      isEdit: true,
      companyId: asset.companyId,
      departmentId: asset.departmentId ?? asset.department?.id ?? "",
      assetCategoryId: asset.assetType?.assetCategory?.id ?? "",
      assetTypeId: asset.assetTypeId,
      assetName: asset.assetName,
      kind: asset.kind,
      trackingMode: asset.trackingMode,
      serialNumber: asset.serialNumber ?? "",
      manufacturer: asset.manufacturer ?? "",
      modelNumber: asset.modelNumber ?? "",
      purchaseDate: asset.purchaseDate?.toString().substring(0, 10) ?? "",
      purchaseCost:
        asset.purchaseCost == null ? undefined : Number(asset.purchaseCost),
      currency: asset.currency ?? "",
      warrantyExpiry: asset.warrantyExpiry?.toString().substring(0, 10) ?? "",
      location: asset.location ?? "",
      remarks: asset.remarks ?? "",
    });
  }, [asset, form]);

  return (
    <form
      id="asset-form"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      {form.formState.isSubmitted && Object.keys(form.formState.errors).length > 0 ? (
        <p className="text-sm text-destructive">
          Fix the highlighted fields, then save again.
        </p>
      ) : null}
      <FormSection title="General Information">
        <TransactionFormLayout>
          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-company" required>
              Company
            </RequiredLabel>
            <Controller
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <LookupSelect
                  id="asset-company"
                  value={field.value ?? ""}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("departmentId", "");
                    form.setValue("assetCategoryId", "");
                    form.setValue("assetTypeId", "");
                  }}
                  items={companies}
                  placeholder="Select Company"
                  loading={companiesLoading}
                  disabled={editing}
                />
              )}
            />
            <FieldError message={form.formState.errors.companyId?.message} />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-department" required>
              Department
            </RequiredLabel>
            <Controller
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <LookupSelect
                  id="asset-department"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  items={departmentItems}
                  placeholder="Select Department"
                  loading={departmentsLoading}
                  disabled={editing || !companyId}
                />
              )}
            />
            <FieldError message={form.formState.errors.departmentId?.message} />
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-category" required>
              Asset Category
            </RequiredLabel>
            <Controller
              control={form.control}
              name="assetCategoryId"
              render={({ field }) => (
                <LookupSelect
                  id="asset-category"
                  value={field.value ?? ""}
                  onChange={(value) => {
                    field.onChange(value);
                    form.setValue("assetTypeId", "");
                  }}
                  items={assetCategoryItems}
                  placeholder="Select Asset Category"
                  loading={assetCategoriesLoading}
                  disabled={editing}
                />
              )}
            />
            {!assetCategoriesLoading && assetCategoryItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No categories yet.{" "}
                <Link
                  href="/asset-management/asset-categories"
                  className="text-primary underline"
                >
                  Create a category
                </Link>{" "}
                first, then come back to Add asset.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-type" required>
              {catalog === "LICENSE" ? "Licence type" : "Asset type"}
            </RequiredLabel>
            <Controller
              control={form.control}
              name="assetTypeId"
              render={({ field }) => (
                <LookupSelect
                  id="asset-type"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  items={assetTypeItems}
                  placeholder={
                    catalog === "LICENSE"
                      ? "Select a software licence type"
                      : "Select asset type"
                  }
                  loading={assetTypesLoading}
                  disabled={editing}
                />
              )}
            />
            <FieldError message={form.formState.errors.assetTypeId?.message} />
            {!assetTypesLoading &&
            selectedCategoryId &&
            assetTypeItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No types in this category.{" "}
                <Link
                  href="/asset-management/asset-types"
                  className="text-primary underline"
                >
                  Create a type
                </Link>
                , then return here.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-name" required>
              {catalog === "LICENSE" ? "Licence name" : "Asset name"}
            </RequiredLabel>
            <Input
              id="asset-name"
              {...form.register("assetName")}
              placeholder={
                catalog === "LICENSE"
                  ? "e.g. Microsoft 365 Business"
                  : "Asset name"
              }
            />
            <FieldError message={form.formState.errors.assetName?.message} />
          </div>

          {kind ? (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                Kind: {ASSET_KIND_LABELS[kind]} · Tracking:{" "}
                {trackingMode ?? "—"}
              </p>
            </div>
          ) : null}
        </TransactionFormLayout>
      </FormSection>

      {kind === "HARDWARE" || (kind === "GENERAL" && trackingMode === "INDIVIDUAL") ? (
        <FormSection title="Identifier">
          <TransactionFormLayout>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-serial-number" required={kind === "HARDWARE"}>
                Serial Number
              </RequiredLabel>
              <Input
                id="asset-serial-number"
                {...form.register("serialNumber")}
                placeholder="Serial Number"
                disabled={editing}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-manufacturer">Manufacturer</RequiredLabel>
              <Input
                id="asset-manufacturer"
                {...form.register("manufacturer")}
                placeholder="Manufacturer"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <RequiredLabel htmlFor="asset-model-number">Model Number</RequiredLabel>
              <Input
                id="asset-model-number"
                {...form.register("modelNumber")}
                placeholder="Model Number"
              />
            </div>
          </TransactionFormLayout>
        </FormSection>
      ) : null}

      {kind === "GENERAL" || kind === "HARDWARE" ? (
        <FormSection title="Location">
          <TransactionFormLayout columns={1}>
            <div className="space-y-2">
              <RequiredLabel
                htmlFor="asset-location"
                required={kind === "GENERAL" && trackingMode === "LOCATION"}
              >
                Location
              </RequiredLabel>
              <Input
                id="asset-location"
                {...form.register("location")}
                placeholder="Location"
              />
            </div>
          </TransactionFormLayout>
        </FormSection>
      ) : null}

      {kind === "CARD" ? (
        <FormSection title="Card details">
          <TransactionFormLayout>
            {!editing ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="asset-card-number" required>
                  Card number
                </RequiredLabel>
                <Input
                  id="asset-card-number"
                  {...form.register("cardNumber")}
                  placeholder="Card number"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  The full number is stored encrypted and is not shown again.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground md:col-span-2">
                The card number is masked after create and cannot be viewed here.
              </p>
            )}
            {!editing ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="asset-card-issued-date" required>
                  Issued date
                </RequiredLabel>
                <Input
                  id="asset-card-issued-date"
                  type="date"
                  {...form.register("cardIssuedDate")}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-card-issuer">Issuer</RequiredLabel>
              <Input
                id="asset-card-issuer"
                {...form.register("cardIssuer")}
                placeholder="Issuer"
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-card-access-zone">
                Access zone
              </RequiredLabel>
              <Input
                id="asset-card-access-zone"
                {...form.register("cardAccessZone")}
                placeholder="Access zone"
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-card-expiry-date">
                Expiry date
              </RequiredLabel>
              <Input
                id="asset-card-expiry-date"
                type="date"
                {...form.register("cardExpiryDate")}
              />
            </div>
          </TransactionFormLayout>
        </FormSection>
      ) : null}

      {kind === "SOFTWARE_LICENSE" ? (
        <FormSection title="Licence pool">
          <TransactionFormLayout>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-vendor" required>
                Vendor
              </RequiredLabel>
              <Input
                id="asset-vendor"
                {...form.register("vendorName")}
                placeholder="Vendor"
              />
              <FieldError message={form.formState.errors.vendorName?.message} />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-product" required>
                Product
              </RequiredLabel>
              <Input
                id="asset-product"
                {...form.register("productName")}
                placeholder="Product"
              />
              <FieldError message={form.formState.errors.productName?.message} />
            </div>
            {!editing ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="asset-seat-capacity" required>
                  Seat capacity
                </RequiredLabel>
                <Input
                  id="asset-seat-capacity"
                  type="number"
                  min={1}
                  {...form.register("seatCapacity", { valueAsNumber: true })}
                />
                <FieldError message={form.formState.errors.seatCapacity?.message} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground md:col-span-2">
                Seat capacity is changed with Resize pool on the Licences page, not this form.
              </p>
            )}
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-contract-reference">
                Contract reference
              </RequiredLabel>
              <Input
                id="asset-contract-reference"
                {...form.register("contractReference")}
                placeholder="Optional"
              />
              <p className="text-xs text-muted-foreground">
                Optional PO or agreement id. Leave blank if you do not have one.
              </p>
              <FieldError message={form.formState.errors.contractReference?.message} />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-vault-reference">
                Vault reference
              </RequiredLabel>
              <Input
                id="asset-vault-reference"
                {...form.register("vaultReference")}
                placeholder="Key vault pointer"
              />
              <p className="text-xs text-muted-foreground">
                Do not enter licence keys. Store a vault pointer only.
              </p>
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-licence-starts">
                Licence starts
              </RequiredLabel>
              <Input
                id="asset-licence-starts"
                type="date"
                {...form.register("licenseStartsOn")}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-licence-expires">
                Licence expires
              </RequiredLabel>
              <Input
                id="asset-licence-expires"
                type="date"
                {...form.register("licenseExpiresOn")}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-licence-renews-on">
                Renewal date
              </RequiredLabel>
              <Input
                id="asset-licence-renews-on"
                type="date"
                {...form.register("licenseRenewsOn")}
              />
            </div>
          </TransactionFormLayout>
        </FormSection>
      ) : null}

      {kind !== "SOFTWARE_LICENSE" && kind !== "CARD" ? (
        <FormSection title="Purchase Information">
          <TransactionFormLayout>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-purchase-date">
                Purchase Date
              </RequiredLabel>
              <Input
                id="asset-purchase-date"
                type="date"
                {...form.register("purchaseDate")}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-purchase-cost">
                Purchase Cost
              </RequiredLabel>
              <Input
                id="asset-purchase-cost"
                type="number"
                step="0.01"
                {...form.register("purchaseCost", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-currency">Currency</RequiredLabel>
              <Input
                id="asset-currency"
                {...form.register("currency")}
                placeholder="Currency"
              />
            </div>
            <div className="space-y-2">
              <RequiredLabel htmlFor="asset-warranty-expiry">
                Warranty expiry
              </RequiredLabel>
              <Input
                id="asset-warranty-expiry"
                type="date"
                {...form.register("warrantyExpiry")}
              />
            </div>
          </TransactionFormLayout>
        </FormSection>
      ) : null}

      <FormSection title="Notes">
        <TransactionFormLayout columns={1}>
          <div className="space-y-2">
            <RequiredLabel htmlFor="asset-remarks">Remarks</RequiredLabel>
            <Textarea
              id="asset-remarks"
              rows={3}
              {...form.register("remarks")}
              placeholder="Remarks"
            />
          </div>
        </TransactionFormLayout>
      </FormSection>
    </form>
  );
}
