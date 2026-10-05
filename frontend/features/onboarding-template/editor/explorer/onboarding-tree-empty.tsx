"use client";

import { FolderTree } from "lucide-react";

export function OnboardingTreeEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <FolderTree className="h-10 w-10 text-muted-foreground" />

      <div>
        <h3 className="font-medium">
          No Departments
        </h3>

        <p className="text-sm text-muted-foreground">
          Create your first onboarding department.
        </p>
      </div>
    </div>
  );
}