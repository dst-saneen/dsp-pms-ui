"use client";

import { FormDialog } from "@/components/common/form-dialog";

import { AssetCategoryForm } from "../forms/asset-category-form";

import { useCreateAssetCategory } from "../hooks/use-create-asset-category";
import { useUpdateAssetCategory } from "../hooks/use-update-asset-category";

import { createOperationId } from "@/features/asset/lib/operation-id";
import type { AssetCategory } from "../types/asset-category";
import type { AssetCategoryFormValues } from "../validation/asset-category-schema";
import { Button } from "@/components/ui/button";

interface AssetCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetCategory: AssetCategory | null;
}

export function AssetCategoryDialog({
  open,
  onOpenChange,
  assetCategory,
}: AssetCategoryDialogProps) {

  const createMutation = useCreateAssetCategory();
  const updateMutation = useUpdateAssetCategory();

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending;

  const closeDialog = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: AssetCategoryFormValues) => {
    if (assetCategory) {
      updateMutation.mutate(
        {
          id: assetCategory.id,
          data: {
            operationId: createOperationId(),
            expectedVersion: assetCategory.version,
            assetCategoryName: data.assetCategoryName,
            description: data.description || null,
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
        assetCategoryName: data.assetCategoryName,
        description: data.description || undefined,
      },
      { onSuccess: closeDialog },
    );
  };

  return (
    <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
        assetCategory
            ? "Edit Asset Category"
            : "Create Asset Category"
        }
        description="Manage asset category information"
        size="md"
        footer={
        <div className="flex items-center justify-end gap-2">
            <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
            >
                Cancel
            </Button>

            <Button
                type="submit"
                form="asset-category-form"
                disabled={isSaving}
            >
                {isSaving
                ? "Saving..."
                : assetCategory
                    ? "Update"
                    : "Save"}
            </Button>
        </div>
        }
    >
        <AssetCategoryForm
        assetCategory={assetCategory}
        onSubmit={handleSubmit}
        />
    </FormDialog>
    );
}
