"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { EmployeeDocumentCategory } from "../types/employee-document-category";

interface EmployeeDocumentCategoryActionsProps {
  category: EmployeeDocumentCategory;

  onDelete?: (
    category: EmployeeDocumentCategory,
  ) => void;
}

export function EmployeeDocumentCategoryActions({
  category,
  onDelete,
}: EmployeeDocumentCategoryActionsProps) {
  return (
    <div className="flex justify-end">
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.(category);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}