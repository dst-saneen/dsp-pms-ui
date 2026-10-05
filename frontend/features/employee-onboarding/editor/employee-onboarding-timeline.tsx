"use client";

import { format } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock3,
  FilePlus2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

interface EmployeeOnboardingTimelineProps {
  onboarding: EmployeeOnboarding;
}

interface TimelineItem {
  title: string;
  date?: string | Date | null;
  icon: React.ReactNode;
}

export function EmployeeOnboardingTimeline({
  onboarding,
}: EmployeeOnboardingTimelineProps) {
  const events: TimelineItem[] = [
    {
      title: "Onboarding Created",
      date: onboarding.createdAt,
      icon: <FilePlus2 className="h-4 w-4" />,
    },
    {
      title: "Onboarding Started",
      date: onboarding.startDate,
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      title: "Last Updated",
      date: onboarding.updatedAt,
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      title: "Completed",
      date: onboarding.completedDate,
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {events.map((event) => (
            <div
              key={event.title}
              className="flex items-start gap-4"
            >
              <div className="mt-1 rounded-full border p-2">
                {event.icon}
              </div>

              <div className="flex-1">
                <div className="font-medium">
                  {event.title}
                </div>

                <div className="text-sm text-muted-foreground">
                  {event.date
                    ? format(
                        new Date(event.date),
                        "dd MMM yyyy HH:mm",
                      )
                    : "-"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}