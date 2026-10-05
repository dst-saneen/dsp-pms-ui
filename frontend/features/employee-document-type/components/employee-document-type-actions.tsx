"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { EmployeeDocumentType } from "../types/employee-document-type";

interface EmployeeDocumentTypeActionsProps {
  documentType: EmployeeDocumentType;
  onDelete?: (documentType: EmployeeDocumentType) => void;
}

export function EmployeeDocumentTypeActions({
  documentType,
  onDelete,
}: EmployeeDocumentTypeActionsProps) {
  return (
    <div className="flex justify-end">
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive"
        onClick={(e) => {
          e.stopPropagation(); // Prevent opening the edit dialog
          onDelete?.(documentType);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}