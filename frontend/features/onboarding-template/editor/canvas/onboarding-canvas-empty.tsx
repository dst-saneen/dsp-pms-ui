"use client";

import { MousePointerClick } from "lucide-react";

export function OnboardingCanvasEmpty() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-3 text-center">

        <MousePointerClick className="mx-auto h-10 w-10 text-muted-foreground" />

        <h3 className="text-lg font-semibold">
          Select an item
        </h3>

        <p className="text-sm text-muted-foreground">
          Choose a department or contribution from the Explorer.
        </p>

      </div>
    </div>
  );
}