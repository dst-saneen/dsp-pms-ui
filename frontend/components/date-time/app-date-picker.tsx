"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { Matcher } from "react-day-picker";

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

export type AppDatePickerCaptionLayout =
  | "label"
  | "dropdown"
  | "dropdown-months"
  | "dropdown-years";

export interface AppDatePickerProps {
  value?: string | null;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Disable calendar days (react-day-picker matchers). */
  disabledDays?: Matcher | Matcher[];
  /** Min selectable date (inclusive). */
  minDate?: Date;
  /** Max selectable date (inclusive). */
  maxDate?: Date;
  /** DayPicker caption controls — use `dropdown` for month/year selects. */
  captionLayout?: AppDatePickerCaptionLayout;
  fromYear?: number;
  toYear?: number;
  id?: string;
  name?: string;
  className?: string;
  /** Marks the trigger invalid for form validation styling. */
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

function buildDisabledMatchers(
  disabledDays: Matcher | Matcher[] | undefined,
  minDate?: Date,
  maxDate?: Date,
): Matcher | Matcher[] | undefined {
  const matchers: Matcher[] = [];

  if (disabledDays) {
    if (Array.isArray(disabledDays)) matchers.push(...disabledDays);
    else matchers.push(disabledDays);
  }
  if (minDate) matchers.push({ before: minDate });
  if (maxDate) matchers.push({ after: maxDate });

  if (matchers.length === 0) return undefined;
  if (matchers.length === 1) return matchers[0];
  return matchers;
}

export function AppDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  disabledDays,
  minDate,
  maxDate,
  captionLayout = "dropdown",
  fromYear = 1960,
  toYear = 2040,
  id,
  name,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: AppDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseAppDate(value);
  const disabledMatchers = buildDisabledMatchers(
    disabledDays,
    minDate,
    maxDate,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-empty={!selected}
          className={cn(
            "h-9 w-full min-w-0 justify-start gap-2 rounded-lg border-input bg-card px-3 text-left text-sm font-normal shadow-xs hover:bg-card max-sm:h-11",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected ? formatAppDateDisplay(selected) : placeholder}
          </span>
          {name ? (
            <input type="hidden" name={name} value={value ?? ""} readOnly />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 overflow-visible rounded-xl border-border/80 p-0 shadow-[0_10px_40px_rgba(16,24,40,0.12)] ring-1 ring-foreground/5"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Year/month menus render inside this content; don't dismiss on their clicks.
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-slot=calendar]")) {
            event.preventDefault();
          }
        }}
      >
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout={captionLayout}
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear, 11)}
          disabled={disabledMatchers}
          onSelect={(date) => {
            onChange?.(date ? formatAppDateValue(date) : undefined);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
