"use client";

import type { ReactNode } from "react";
import { AlertCircle, Lock, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

import type { DashboardWidgetMeta } from "./types";

interface DashboardWidgetShellProps {
  title: string;
  icon: LucideIcon;
  meta: DashboardWidgetMeta;
  onRetry?: () => void;
  emptyMessage?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardWidgetShell({
  title,
  icon: Icon,
  meta,
  onRetry,
  emptyMessage,
  children,
  className,
}: DashboardWidgetShellProps) {
  if (meta.status === "hidden") {
    return null;
  }

  return (
    <Card className={className ?? "gap-0 py-0"}>
      <CardHeader className="border-border border-b px-4 py-4 sm:px-5">
        <CardTitle className="flex items-center gap-2.5 font-semibold">
          <Icon className="text-primary size-[18px]" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {meta.status === "not_authorized" ? (
          <WidgetNotice
            icon={Lock}
            title="Not authorized"
            message={
              meta.message ?? "You do not have permission to view this widget."
            }
          />
        ) : null}

        {meta.status === "not_enabled" ? (
          <WidgetNotice
            icon={ShieldOff}
            title="Not enabled"
            message={
              meta.message ??
              "This module is not enabled for your organization."
            }
          />
        ) : null}

        {meta.status === "error" ? (
          <WidgetNotice
            icon={AlertCircle}
            title="Could not load"
            message={meta.message ?? "Something went wrong."}
            action={
              meta.retryable && onRetry ? (
                <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                  Retry
                </Button>
              ) : null
            }
          />
        ) : null}

        {meta.status === "empty" ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {emptyMessage ?? "Nothing to show."}
          </div>
        ) : null}

        {meta.status === "ok" ? children : null}
      </CardContent>
    </Card>
  );
}

function WidgetNotice({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Icon className="text-muted-foreground size-5" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground max-w-sm text-xs">{message}</p>
      {action}
    </div>
  );
}
