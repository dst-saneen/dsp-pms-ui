"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface ContributionToolbarProps {
  onAdd?: () => void;
}

export function ContributionToolbar({
  onAdd,
}: ContributionToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">
          Contributions
        </h3>

        <p className="text-sm text-muted-foreground">
          Attach reusable contribution definitions to this task.
        </p>
      </div>

      <Button
        type="button"
        onClick={onAdd}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Contribution
      </Button>
    </div>
  );
}