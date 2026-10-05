"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ExecutionRuleToolbarProps {
  onAdd(): void;
}

export function ExecutionRuleToolbar({
  onAdd,
}: ExecutionRuleToolbarProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-semibold">
          Execution Rules
        </h3>

        <p className="text-sm text-muted-foreground">
          Configure execution workflow steps.
        </p>
      </div>

      <Button onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add Execution Rule
      </Button>
    </div>
  );
}