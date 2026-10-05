"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface RequirementToolbarProps {
  onAdd?: () => void;
}

export function RequirementToolbar({
  onAdd,
}: RequirementToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">
          Requirements
        </h3>

        <p className="text-sm text-muted-foreground">
          Attach reusable requirement definitions.
        </p>
      </div>

      <Button
        type="button"
        onClick={onAdd}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Requirement
      </Button>
    </div>
  );
}