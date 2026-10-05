"use client";

import { Button } from "@/components/ui/button";

interface Props {
  onAddStage?: () => void;
}

export function WorkflowToolbar({
  onAddStage,
}: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">

      <div>
        <h3 className="text-lg font-semibold">
          Workflow Stages
        </h3>

        <p className="text-sm text-muted-foreground">
          Configure onboarding stages and their tasks.
        </p>
      </div>

      <Button
        type="button"
        onClick={onAddStage}
      >
        Add Stage
      </Button>

    </div>
  );
}