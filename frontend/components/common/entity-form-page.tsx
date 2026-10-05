"use client";

import type { ReactNode } from "react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EntityFormPageProps {
  title: string;
  description?: string;
  /** Optional header actions (e.g. Open checklist link). */
  headerActions?: ReactNode;
  children: ReactNode;
  /** Form element id for the primary submit button. */
  formId: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onSecondary: () => void;
  isSaving?: boolean;
  /** Disable primary submit without hiding it (e.g. preflight blocked). */
  primaryDisabled?: boolean;
  /** Show destructive control (opens confirm outside this chrome). */
  showDelete?: boolean;
  deleteLabel?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  className?: string;
  /** Hide the sticky primary Save button (e.g. read-only view). */
  showPrimary?: boolean;
}

/**
 * Dedicated create/edit page chrome (UX-05).
 * Pair with useUnsavedChanges on secondary/back handlers.
 */
export function EntityFormPage({
  title,
  description,
  headerActions,
  children,
  formId,
  primaryLabel = "Save",
  secondaryLabel = "Cancel",
  onSecondary,
  isSaving = false,
  primaryDisabled = false,
  showDelete = false,
  deleteLabel = "Delete",
  onDelete,
  isDeleting = false,
  className,
  showPrimary = true,
}: EntityFormPageProps) {
  return (
    <PageContainer className={cn("pb-24", className)}>
      <PageHeader
        title={title}
        description={description}
        actions={headerActions}
      />

      <div className="min-w-0">{children}</div>

      <div
        className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-20 -mx-3 border-t px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:-mx-5 md:px-5 xl:-mx-6 xl:px-6"
        role="region"
        aria-label="Form actions"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {showDelete ? (
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting || isSaving}
                onClick={onDelete}
              >
                {isDeleting ? "Deleting…" : deleteLabel}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </Button>
            {showPrimary ? (
              <Button
                type="submit"
                form={formId}
                disabled={isSaving || primaryDisabled}
              >
                {isSaving ? "Saving…" : primaryLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
