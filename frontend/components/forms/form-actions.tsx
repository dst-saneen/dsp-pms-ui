"use client";

import { Button } from "@/components/ui/button";

interface FormActionsProps {
  formId: string;
  editing?: boolean;
  saving?: boolean;
  deleting?: boolean;
  showDelete?: boolean;
  onCancel: () => void;
  onDelete?: () => void;
}

export function FormActions({
  formId,
  editing = false,
  saving = false,
  deleting = false,
  showDelete = false,
  onCancel,
  onDelete,
}: FormActionsProps) {
  return (
    <div className="flex w-full items-center">

      <div className="flex-1">
        {showDelete && editing && (
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={onDelete}
          >
            Delete
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          form={formId}
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : editing
            ? "Update"
            : "Save"}
        </Button>
      </div>

    </div>
  );
}