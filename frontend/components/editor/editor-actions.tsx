"use client";

import { ArrowLeft, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  formId: string;

  isNew: boolean;

  saving?: boolean;

  deleting?: boolean;

  onBack: () => void;

  onDelete?: () => void;
}

export function EditorActions({
  formId,
  isNew,
  saving = false,
  deleting = false,
  onBack,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-2">

      <Button
        type="button"
        variant="outline"
        onClick={onBack}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      {!isNew && onDelete && (
        <Button
          type="button"
          variant="destructive"
          disabled={deleting}
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      )}

      <Button
        type="submit"
        form={formId}
        disabled={saving}
      >
        <Save className="mr-2 h-4 w-4" />

        {saving
          ? "Saving..."
          : isNew
            ? "Create"
            : "Save"}
      </Button>

    </div>
  );
}