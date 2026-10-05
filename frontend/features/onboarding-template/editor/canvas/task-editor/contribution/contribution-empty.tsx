"use client";

import { FilePlus2 } from "lucide-react";

export function ContributionEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
      <FilePlus2 className="mb-4 h-10 w-10 text-muted-foreground" />

      <h3 className="text-lg font-semibold">
        No Contributions
      </h3>

      <p className="mt-2 max-w-lg text-center text-sm text-muted-foreground">
        This task does not currently reference any contribution definitions.
      </p>
    </div>
  );
}