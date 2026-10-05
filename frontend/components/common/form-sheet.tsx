"use client";

import { FilePenLine } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type FormSheetSize = "sm" | "md" | "lg" | "xl" | "2xl";

export interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  size?: FormSheetSize;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  onCloseAutoFocus?: ComponentProps<typeof SheetContent>["onCloseAutoFocus"];
}

const sizes: Record<FormSheetSize, string> = {
  sm: "sm:data-[side=right]:w-[420px] sm:data-[side=right]:max-w-[420px]",
  md: "sm:data-[side=right]:w-[520px] sm:data-[side=right]:max-w-[520px]",
  lg: "sm:data-[side=right]:w-[640px] sm:data-[side=right]:max-w-[640px]",
  xl: "sm:data-[side=right]:w-[760px] sm:data-[side=right]:max-w-[760px]",
  "2xl": "sm:data-[side=right]:w-[900px] sm:data-[side=right]:max-w-[900px]",
};

export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  size = "lg",
  children,
  footer,
  className,
  bodyClassName,
  onCloseAutoFocus,
}: FormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        onCloseAutoFocus={onCloseAutoFocus}
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="bg-slate-950/45 backdrop-blur-[1px]"
        className={cn(
          "gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:max-w-none",
          sizes[size],
          className
        )}
      >
        <SheetHeader className="border-border shrink-0 border-b px-5 py-4 pr-14 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="bg-primary-soft text-primary ring-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset">
              <FilePenLine className="size-[18px]" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
              <SheetDescription className={cn(!description && "sr-only")}>
                {description ?? `Complete the ${title.toLowerCase()} form.`}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6",
            bodyClassName
          )}
        >
          {children}
        </div>

        {footer ? (
          <div className="border-border bg-muted/35 shrink-0 border-t px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
