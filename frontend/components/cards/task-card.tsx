"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Badge,
} from "@/components/ui/badge";

import { cn } from "@/lib/utils";

export interface TaskCardProps {

  title: string;

  sequence?: number;

  description?: string;

  workType?: string;

  mandatory?: boolean;

  selected?: boolean;

  disabled?: boolean;

  actions?: React.ReactNode;

  onClick?(): void;

}

export function TaskCard({

  title,

  sequence,

  description,

  workType,

  mandatory,

  selected,

  disabled,

  actions,

  onClick,

}: TaskCardProps) {

  return (

    <Card
      className={cn(

        "cursor-pointer transition-colors",

        selected &&
          "border-primary",

        disabled &&
          "opacity-60 cursor-not-allowed",

      )}

      onClick={() => {

        if (!disabled) {

          onClick?.();

        }

      }}
    >

      <CardContent className="flex items-start justify-between gap-4 p-4">

        <div className="min-w-0 flex-1 space-y-2">

          <div className="flex items-center gap-2">

            {sequence !== undefined && (

              <Badge
                variant="secondary"
              >
                {sequence}
              </Badge>

            )}

            <span className="font-medium">

              {title}

            </span>

            {mandatory && (

              <Badge>

                Mandatory

              </Badge>

            )}

          </div>

          {description && (

            <p className="text-sm text-muted-foreground line-clamp-2">

              {description}

            </p>

          )}

          {workType && (

            <Badge
              variant="outline"
            >

              {workType}

            </Badge>

          )}

        </div>

        {actions ?? (

          <Button
            variant="ghost"
            size="icon"
            onClick={e => {

              e.stopPropagation();

            }}
          >

            <MoreHorizontal className="h-4 w-4" />

          </Button>

        )}

      </CardContent>

    </Card>

  );

}