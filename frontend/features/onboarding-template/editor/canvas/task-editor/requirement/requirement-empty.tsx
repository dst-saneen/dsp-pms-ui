"use client";

import { FileSearch } from "lucide-react";

export function RequirementEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <FileSearch className="mb-4 h-10 w-10 text-muted-foreground" />

      <h3 className="text-lg font-semibold">
        No Requirements
      </h3>

      <p className="mt-2 text-center text-sm text-muted-foreground">
        No requirement definitions are attached to this task.
      </p>
    </div>
  );
}