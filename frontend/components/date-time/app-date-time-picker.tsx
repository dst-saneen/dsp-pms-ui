"use client";

import { AppDatePicker } from "./app-date-picker";
import { AppTimePicker } from "./app-time-picker";
import { cn } from "@/lib/utils";

export interface AppDateTimeValue {
  date?: string;
  time?: string;
}

export interface AppDateTimePickerProps {
  value?: AppDateTimeValue | null;
  onChange?: (value: AppDateTimeValue | undefined) => void;
  disabled?: boolean;
  datePlaceholder?: string;
  timePlaceholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

export function AppDateTimePicker({
  value,
  onChange,
  disabled = false,
  datePlaceholder = "Select date",
  timePlaceholder = "Select time",
  className,
  "aria-invalid": ariaInvalid,
}: AppDateTimePickerProps) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      <AppDatePicker
        value={value?.date}
        disabled={disabled}
        placeholder={datePlaceholder}
        aria-invalid={ariaInvalid}
        onChange={(date) => {
          if (!date && !value?.time) {
            onChange?.(undefined);
            return;
          }
          onChange?.({ date, time: value?.time });
        }}
      />
      <AppTimePicker
        value={value?.time}
        disabled={disabled}
        placeholder={timePlaceholder}
        aria-invalid={ariaInvalid}
        onChange={(time) => {
          if (!time && !value?.date) {
            onChange?.(undefined);
            return;
          }
          onChange?.({ date: value?.date, time });
        }}
      />
    </div>
  );
}
