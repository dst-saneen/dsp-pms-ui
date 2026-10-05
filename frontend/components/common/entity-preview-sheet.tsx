"use client";

import { useRef, type ReactNode } from "react";

import { ErrorState } from "@/components/common/error-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

interface EntityPreviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function EntityPreviewSheet({
  open,
  onOpenChange,
  title,
  description,
  isLoading = false,
  error,
  onRetry,
  children,
  footer,
}: EntityPreviewSheetProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={() => {
          if (document.activeElement instanceof HTMLElement) {
            returnFocusRef.current = document.activeElement;
          }
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current) return;
          event.preventDefault();
          returnFocusRef.current.focus();
          returnFocusRef.current = null;
        }}
      >
        <SheetHeader className="border-b border-border px-5 py-4 pr-14">
          <SheetTitle>{title}</SheetTitle>
          {description ? (
            <SheetDescription>{description}</SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="space-y-5" aria-label="Loading preview">
              <div className="flex items-center gap-3">
                <Skeleton className="size-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : error ? (
            <ErrorState
              compact
              title="Preview unavailable"
              description={error}
              onRetry={onRetry}
            />
          ) : (
            children
          )}
        </div>

        {footer && !isLoading && !error ? (
          <SheetFooter className="border-t border-border bg-card px-5 py-4">
            {footer}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
