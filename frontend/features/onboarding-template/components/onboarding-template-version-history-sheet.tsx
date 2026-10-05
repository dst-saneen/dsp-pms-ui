"use client";

import { format } from "date-fns";
import { Archive, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

import { useOnboardingTemplateVersionHistory } from "../hooks/use-onboarding-template-version-history";

import type { OnboardingTemplateVersionHistoryItem } from "../types/onboarding-template-version-history";

interface OnboardingTemplateVersionHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  currentVersionId?: string;
  onArchive?: (versionId: string) => Promise<void>;
  archiving?: boolean;
}

function canArchiveVersion(
  version: OnboardingTemplateVersionHistoryItem,
  currentVersionId?: string,
) {
  return (
    version.id !== currentVersionId &&
    !version.isCurrent &&
    version.status !== "ARCHIVED"
  );
}

export function OnboardingTemplateVersionHistorySheet({
  open,
  onOpenChange,
  templateId,
  currentVersionId,
  onArchive,
  archiving = false,
}: OnboardingTemplateVersionHistorySheetProps) {
  const {
    data: versions = [],
    isLoading,
  } = useOnboardingTemplateVersionHistory(
    open ? templateId : undefined,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            Published and draft versions for this onboarding template.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto pr-1">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No version history available.
            </p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        Version {version.versionNo}
                      </span>

                      <Badge variant="outline">
                        {version.status}
                      </Badge>

                      {version.isCurrent && (
                        <Badge>Current</Badge>
                      )}
                    </div>

                    {version.versionName && (
                      <p className="text-sm text-muted-foreground">
                        {version.versionName}
                      </p>
                    )}

                    <div className="text-xs text-muted-foreground">
                      {version.publishedAt
                        ? `Published ${format(new Date(version.publishedAt), "dd MMM yyyy HH:mm")}`
                        : `Created ${format(new Date(version.createdAt), "dd MMM yyyy HH:mm")}`}
                    </div>

                    {version.changeSummary && (
                      <p className="text-sm">
                        {version.changeSummary}
                      </p>
                    )}
                  </div>

                  {onArchive &&
                    canArchiveVersion(
                      version,
                      currentVersionId,
                    ) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={archiving}
                        onClick={() => {
                          void onArchive(version.id);
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </Button>
                    )}
                </div>
              </div>
            ))
          )}
        </div>

        {onArchive && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            Create Draft clones the current published version into a new draft.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
