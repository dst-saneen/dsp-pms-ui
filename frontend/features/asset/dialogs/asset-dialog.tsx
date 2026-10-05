"use client";

import { FormDialog } from "@/components/common/form-dialog";
import { FormActions } from "@/components/forms";
import { createOperationId } from "../lib/operation-id";
import { AssetForm } from "../forms/asset-form";
import { useCreateAsset } from "../hooks/use-create-asset";
import { useUpdateAsset } from "../hooks/use-update-asset";
import { isSoftwareLicenseKind } from "../lib/kind-tracking";
import type { AssetCatalog } from "../lib/kind-tracking";
import type { Asset, CreateAssetDto, UpdateAssetDto } from "../types/asset";
import type { AssetFormValues } from "../validation/asset-schema";

interface AssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: Asset | null;
  catalog?: AssetCatalog;
}

function blankToUndefined(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function AssetDialog({
  open,
  onOpenChange,
  asset,
  catalog = "PHYSICAL",
}: AssetDialogProps) {
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: AssetFormValues) => {
    if (asset) {
      const payload: UpdateAssetDto = {
        operationId: createOperationId(),
        expectedVersion: asset.version,
        assetName: data.assetName,
        manufacturer: blankToUndefined(data.manufacturer),
        modelNumber: blankToUndefined(data.modelNumber),
        purchaseDate: blankToUndefined(data.purchaseDate) ?? null,
        purchaseCost:
          data.purchaseCost == null ? undefined : String(data.purchaseCost),
        currency: blankToUndefined(data.currency) ?? null,
        warrantyExpiry: blankToUndefined(data.warrantyExpiry) ?? null,
        location: blankToUndefined(data.location) ?? null,
        remarks: blankToUndefined(data.remarks) ?? null,
      };

      if (asset.kind === "CARD") {
        payload.cardMetadata = {
          issuer: blankToUndefined(data.cardIssuer) ?? null,
          accessZone: blankToUndefined(data.cardAccessZone) ?? null,
          expiryDate: blankToUndefined(data.cardExpiryDate) ?? null,
        };
      }

      if (asset.kind === "SOFTWARE_LICENSE") {
        payload.licenseMetadata = {
          vendorName: blankToUndefined(data.vendorName),
          productName: blankToUndefined(data.productName),
          contractReference: blankToUndefined(data.contractReference) ?? null,
          vaultReference: blankToUndefined(data.vaultReference) ?? null,
          startsOn: blankToUndefined(data.licenseStartsOn) ?? null,
          expiresOn: blankToUndefined(data.licenseExpiresOn) ?? null,
          renewsOn: blankToUndefined(data.licenseRenewsOn) ?? null,
        };
      }

      updateMutation.mutate(
        { id: asset.id, data: payload },
        { onSuccess: closeDialog },
      );
      return;
    }

    const payload: CreateAssetDto = {
      operationId: createOperationId(),
      companyId: data.companyId,
      departmentId: data.departmentId,
      assetTypeId: data.assetTypeId,
      assetName: data.assetName,
      serialNumber: blankToUndefined(data.serialNumber),
      manufacturer: blankToUndefined(data.manufacturer),
      modelNumber: blankToUndefined(data.modelNumber),
      purchaseDate: blankToUndefined(data.purchaseDate),
      purchaseCost:
        data.purchaseCost == null ? undefined : String(data.purchaseCost),
      currency: blankToUndefined(data.currency),
      warrantyExpiry: blankToUndefined(data.warrantyExpiry),
      location: blankToUndefined(data.location),
      remarks: blankToUndefined(data.remarks),
    };

    if (data.kind === "CARD") {
      payload.card = {
        cardNumber: data.cardNumber!.trim(),
        issuedDate: data.cardIssuedDate!,
        issuer: blankToUndefined(data.cardIssuer),
        accessZone: blankToUndefined(data.cardAccessZone),
        expiryDate: blankToUndefined(data.cardExpiryDate),
      };
    }

    if (data.kind === "SOFTWARE_LICENSE") {
      payload.softwareLicense = {
        vendorName: data.vendorName!.trim(),
        productName: data.productName!.trim(),
        seatCapacity: Number(data.seatCapacity),
        contractReference: blankToUndefined(data.contractReference),
        vaultReference: blankToUndefined(data.vaultReference),
        startsOn: blankToUndefined(data.licenseStartsOn),
        expiresOn: blankToUndefined(data.licenseExpiresOn),
        renewsOn: blankToUndefined(data.licenseRenewsOn),
      };
    }

    createMutation.mutate(payload, { onSuccess: closeDialog });
  };

  const isLicence =
    catalog === "LICENSE" || isSoftwareLicenseKind(asset?.kind);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        asset
          ? isLicence
            ? "Edit licence pool"
            : "Edit asset"
          : isLicence
            ? "Create licence pool"
            : "Create asset"
      }
      description={
        isLicence
          ? "Vendor, product, seats, and licence expiry. This is not a physical item."
          : "Physical item details. Software licences are created on the Licences page."
      }
      size="xl"
      footer={
        <FormActions
          formId="asset-form"
          editing={!!asset}
          saving={isSaving}
          showDelete={false}
          onCancel={closeDialog}
        />
      }
    >
        {open ? (
          <AssetForm
            key={asset?.id ?? "new"}
            asset={asset}
            catalog={catalog}
            onSubmit={handleSubmit}
            isSaving={isSaving}
          />
        ) : null}
    </FormDialog>
  );
}
