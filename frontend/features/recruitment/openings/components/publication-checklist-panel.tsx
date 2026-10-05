"use client";

import type { KeyboardEvent } from "react";
import { CheckCircle2, CircleX } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PublicationChecklist } from "../types/publication-checklist";

interface PublicationChecklistPanelProps {
  checklist?: PublicationChecklist;
  isLoading?: boolean;
  onFocusItem?: (code: string) => void;
}

export function PublicationChecklistPanel({
  checklist,
  isLoading,
  onFocusItem,
}: PublicationChecklistPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Loading publication checklist…
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Save the opening draft to review publication requirements.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Publication checklist</p>
        <p className="text-sm text-muted-foreground">
          The server validates these items before an opening can be published.
          Failed items open the related form section.
        </p>
      </div>

      <div className="space-y-3">
        {checklist.items.map((item) => {
          const interactive = !item.passed && Boolean(onFocusItem);

          return (
            <div
              key={item.code}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left",
                item.passed
                  ? "border-success/20 bg-success/5"
                  : "border-warning/20 bg-warning/5",
                interactive &&
                  "cursor-pointer transition-colors hover:border-warning/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning",
              )}
              {...(interactive
                ? {
                    role: "button" as const,
                    tabIndex: 0,
                    onClick: () => onFocusItem?.(item.code),
                    onKeyDown: (event: KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onFocusItem?.(item.code);
                      }
                    },
                  }
                : {})}
            >
              {item.passed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <CircleX className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              )}
              <div>
                <p className="font-medium">{item.label}</p>
                {item.message ? (
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                ) : null}
                {interactive ? (
                  <p className="mt-1 text-xs font-medium text-warning">
                    Jump to field
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {!checklist.canPublish ? (
        <p className="text-sm text-muted-foreground">
          Publish stays unavailable until every checklist item passes.
        </p>
      ) : (
        <p className="text-sm text-success">Ready to publish.</p>
      )}
    </div>
  );
}
