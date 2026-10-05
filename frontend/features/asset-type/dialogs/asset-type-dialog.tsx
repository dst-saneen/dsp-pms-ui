"use client";

import { FormDialog } from "@/components/common/form-dialog";

import { AssetTypeForm } from "../forms/asset-type-form";
import { useCreateAssetType } from "../hooks/use-create-asset-type";
import { useUpdateAssetType } from "../hooks/use-update-asset-type";

import { createOperationId } from "@/features/asset/lib/operation-id";
import type { AssetType } from "../types/asset-type";
import type { AssetTypeFormValues } from "../validation/asset-type-schema";
import { Button } from "@/components/ui/button";

interface AssetTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetType: AssetType | null;
}

export function AssetTypeDialog({
  open,
  onOpenChange,
  assetType,
}: AssetTypeDialogProps) {

  const createMutation = useCreateAssetType();
  const updateMutation = useUpdateAssetType();

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: AssetTypeFormValues) => {
    if (assetType) {
      updateMutation.mutate(
        {
          id: assetType.id,
          data: {
            operationId: createOperationId(),
            expectedVersion: assetType.version,
            assetCategoryId: data.assetCategoryId,
            assetTypeName: data.assetTypeName,
            description: data.description || null,
            kind: assetType.classificationMutable === false ? undefined : data.kind,
            trackingMode:
              assetType.classificationMutable === false
                ? undefined
                : data.trackingMode,
          },
        },
        { onSuccess: closeDialog },
      );
      return;
    }

    createMutation.mutate(
      {
        operationId: createOperationId(),
        companyId: data.companyId,
        assetCategoryId: data.assetCategoryId,
        assetTypeName: data.assetTypeName,
        description: data.description || undefined,
        kind: data.kind,
        trackingMode: data.trackingMode,
      },
      { onSuccess: closeDialog },
    );
  };

  return (
    <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
        assetType
            ? "Edit Asset Type"
            : "Create Asset Type"
        }
        description="Manage asset type information"
        size="md"
        footer={
        <div className="flex items-center justify-end gap-2">
            <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
            >
                Cancel
            </Button>

            <Button
                type="submit"
                form="asset-type-form"
                disabled={isSaving}
            >
                {isSaving
                ? "Saving..."
                : assetType
                    ? "Update"
                    : "Save"}
            </Button>
        </div>
        }
    >
        <AssetTypeForm
        assetType={assetType}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        />
    </FormDialog>
    );
}
