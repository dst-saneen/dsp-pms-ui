import {
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  FileText,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { WorkspaceActivity } from "./types/employee-workspace";

interface EmployeeActivityProps {
  activities: WorkspaceActivity[];
}

function getActivityIcon(title: string) {
  const value = title.toLowerCase();
  if (value.includes("check")) return CalendarCheck2;
  if (value.includes("task")) return ClipboardList;
  if (value.includes("leave")) return FileText;
  return CheckCircle2;
}

export function EmployeeActivity({ activities }: EmployeeActivityProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <p className="text-xs text-muted-foreground">
          Latest workspace updates
        </p>
      </CardHeader>

      <CardContent>
        {activities.length === 0 ? (
          <EmptyState
            compact
            icon={CheckCircle2}
            title="No recent activity"
            description="New activity will appear here."
          />
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.title);

              return (
                <div
                  key={`${activity.title}-${activity.time}-${index}`}
                  className="flex gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {activity.title}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {activity.time}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
