"use client";

import { FormSheet } from "@/components/common/form-sheet";

import { AssignEmployeeAssetForm } from "../forms/assign-employee-asset-form";

interface AssignEmployeeAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string;
  assetId?: string;
}

export function AssignEmployeeAssetDialog({
  open,
  onOpenChange,
  employeeId,
  assetId,
}: AssignEmployeeAssetDialogProps) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Assign physical item"
      description={
        employeeId
          ? "Assign an available laptop, card, or other physical item to this employee."
          : "Select an employee and assign an available physical item. Licence seats are allocated on the Licences page."
      }
      size="lg"
    >
      <AssignEmployeeAssetForm
        employeeId={employeeId}
        assetId={assetId}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
