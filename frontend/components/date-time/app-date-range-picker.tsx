"use client";

import * as React from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  formatAppDateDisplay,
  formatAppDateValue,
  parseAppDate,
} from "./date-utils";

export interface AppDateRangeValue {
  from?: string;
  to?: string;
}

export interface AppDateRangePickerProps {
  value?: AppDateRangeValue | null;
  onChange?: (value: AppDateRangeValue | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Min selectable date (inclusive). */
  minDate?: Date;
  /** Max selectable date (inclusive). */
  maxDate?: Date;
  numberOfMonths?: 1 | 2;
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  fromYear?: number;
  toYear?: number;
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

function toDateRange(value?: AppDateRangeValue | null): DateRange | undefined {
  if (!value?.from && !value?.to) return undefined;
  return {
    from: parseAppDate(value.from),
    to: parseAppDate(value.to),
  };
}

function formatRangeLabel(range?: DateRange): string | null {
  if (!range?.from) return null;
  if (!range.to) return formatAppDateDisplay(range.from);
  return `${formatAppDateDisplay(range.from)} – ${formatAppDateDisplay(range.to)}`;
}

export function AppDateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  minDate,
  maxDate,
  numberOfMonths = 2,
  captionLayout = "label",
  fromYear = 1960,
  toYear = 2040,
  id,
  className,
  "aria-invalid": ariaInvalid,
}: AppDateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toDateRange(value);
  const label = formatRangeLabel(selected);

  const disabledMatchers = React.useMemo((): Matcher[] | undefined => {
    const matchers: Matcher[] = [];
    if (minDate) matchers.push({ before: minDate });
    if (maxDate) matchers.push({ after: maxDate });
    return matchers.length ? matchers : undefined;
  }, [minDate, maxDate]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          data-empty={!label}
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 rounded-lg border-input bg-card px-3 text-left text-sm font-normal shadow-xs hover:bg-card max-sm:h-11",
            !label && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label ?? placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 overflow-visible rounded-xl border-border/80 p-0 shadow-[0_10px_40px_rgba(16,24,40,0.12)] ring-1 ring-foreground/5"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-slot=calendar]")) {
            event.preventDefault();
          }
        }}
      >
        <Calendar
          mode="range"
          selected={selected}
          defaultMonth={selected?.from}
          numberOfMonths={numberOfMonths}
          captionLayout={captionLayout}
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          disabled={disabledMatchers}
          onSelect={(range) => {
            if (!range?.from) {
              onChange?.(undefined);
              return;
            }
            onChange?.({
              from: formatAppDateValue(range.from),
              to: range.to ? formatAppDateValue(range.to) : undefined,
            });
            if (range.from && range.to) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
