"use client";

import * as React from "react";
import { ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  formatAppTimeDisplay,
  formatAppTimeValue,
  parseAppTime,
} from "./date-utils";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export interface AppTimePickerProps {
  value?: string | null;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Minute step (default 5). Use 1 for every minute. */
  minuteStep?: 1 | 5 | 15 | 30;
  id?: string;
  name?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

export function AppTimePicker({
  value,
  onChange,
  placeholder = "Select time",
  disabled = false,
  minuteStep = 5,
  id,
  name,
  className,
  "aria-invalid": ariaInvalid,
}: AppTimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const parsed = parseAppTime(value);
  const display = formatAppTimeDisplay(value);

  const minutes = React.useMemo(() => {
    if (minuteStep === 1) {
      return Array.from({ length: 60 }, (_, minute) => minute);
    }
    return Array.from({ length: Math.floor(60 / minuteStep) }, (_, index) =>
      index * minuteStep,
    );
  }, [minuteStep]);

  const hoursValue = parsed ? String(parsed.hours) : undefined;
  const minutesValue = parsed ? String(parsed.minutes) : undefined;

  const commit = (hours?: number, mins?: number) => {
    if (hours === undefined || mins === undefined) {
      onChange?.(undefined);
      return;
    }
    onChange?.(formatAppTimeValue(hours, mins));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          data-empty={!display}
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 rounded-lg border-input bg-card px-3 text-left text-sm font-normal shadow-xs hover:bg-card max-sm:h-11",
            !display && "text-muted-foreground",
            className,
          )}
        >
          <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{display || placeholder}</span>
          {name ? (
            <input type="hidden" name={name} value={value ?? ""} readOnly />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-3 p-3">
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Hour</p>
            <Select
              value={hoursValue}
              onValueChange={(next) => {
                const hours = Number(next);
                const mins = parsed?.minutes ?? minutes[0] ?? 0;
                commit(hours, mins);
              }}
            >
              <SelectTrigger className="w-[88px]">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour} value={String(hour)}>
                    {String(hour).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="pb-2 text-sm font-semibold text-muted-foreground">
            :
          </span>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Minute</p>
            <Select
              value={minutesValue}
              onValueChange={(next) => {
                const mins = Number(next);
                const hours = parsed?.hours ?? 9;
                commit(hours, mins);
              }}
            >
              <SelectTrigger className="w-[88px]">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={String(minute)}>
                    {String(minute).padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange?.(undefined);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={!parsed}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
