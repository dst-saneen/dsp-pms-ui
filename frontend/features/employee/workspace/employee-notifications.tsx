import {

  Bell,

  CalendarClock,

  ClipboardCheck,

  FileText,

  Wallet,

} from "lucide-react";

import Link from "next/link";



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



import type { WorkspaceNotification } from "./types/employee-workspace";



interface EmployeeNotificationsProps {

  notifications: WorkspaceNotification[];

}



function getNotificationIcon(title: string) {

  const value = title.toLowerCase();

  if (value.includes("task")) return ClipboardCheck;

  if (value.includes("meeting")) return CalendarClock;

  if (value.includes("pay")) return Wallet;

  if (value.includes("document")) return FileText;

  return Bell;

}



function getPriorityTone(priority: string): StatusTone {

  switch (priority.toUpperCase()) {

    case "HIGH":

    case "URGENT":

      return "danger";

    case "MEDIUM":

      return "warning";

    case "LOW":

      return "information";

    default:

      return "neutral";

  }

}



export function EmployeeNotifications({

  notifications,

}: EmployeeNotificationsProps) {

  return (

    <Card className="h-full">

      <CardHeader className="flex-row items-start justify-between">

        <div>

          <CardTitle>Workspace Notifications</CardTitle>

          <p className="mt-1 text-xs text-muted-foreground">

            Updates that may need your attention

          </p>

        </div>

        <span className="text-sm font-medium text-muted-foreground">

          {notifications.length}

        </span>

      </CardHeader>



      <CardContent>

        {notifications.length === 0 ? (

          <EmptyState

            compact

            icon={Bell}

            title="You are all caught up"

            description="New workspace notifications will appear here."

          />

        ) : (

          <div className="divide-y divide-border">

            {notifications.map((notification, index) => {

              const Icon = getNotificationIcon(notification.title);

              const titleNode = notification.href ? (

                <Link

                  href={notification.href}

                  className="font-medium text-foreground underline-offset-2 hover:underline"

                >

                  {notification.title}

                </Link>

              ) : (

                <p className="font-medium text-foreground">

                  {notification.title}

                </p>

              );



              return (

                <div

                  key={`${notification.title}-${notification.time}-${index}`}

                  className="flex gap-3 py-4 first:pt-0 last:pb-0"

                >

                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">

                    <Icon className="size-4" aria-hidden="true" />

                  </span>

                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-start justify-between gap-2">

                      {titleNode}

                      <StatusBadge

                        label={notification.priority}

                        tone={getPriorityTone(notification.priority)}

                      />

                    </div>

                    <p className="mt-1 text-sm text-muted-foreground">

                      {notification.description}

                    </p>

                    <time className="mt-2 block text-xs text-muted-foreground">

                      {notification.time}

                    </time>

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

