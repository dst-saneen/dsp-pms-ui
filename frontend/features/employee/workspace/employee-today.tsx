import { CalendarDays, Clock3 } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/common/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { WorkspaceScheduleItem } from "./types/employee-workspace";

interface EmployeeTodayProps {
  items: WorkspaceScheduleItem[];
}

function formatTime(value: string | null) {
  if (!value) return "Time not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getScheduleTone(status: string): StatusTone {
  const value = status.toLowerCase();
  if (value.includes("complete")) return "success";
  if (value.includes("cancel") || value.includes("overdue")) return "danger";
  if (value.includes("progress")) return "information";
  return "neutral";
}

export function EmployeeToday({ items }: EmployeeTodayProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Today&apos;s Schedule</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Planned work for today
          </p>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarDays}
            title="No work scheduled"
            description="Your schedule is clear for today."
          />
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-start"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="size-4" aria-hidden="true" />
                  <span>{formatTime(item.plannedStartTime)}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <StatusBadge
                  label={item.status}
                  tone={getScheduleTone(item.status)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
