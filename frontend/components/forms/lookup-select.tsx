"use client";

import type { LookupItem } from "@/features/lookups/types/lookup";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CLEAR_LOOKUP_VALUE = "__clear_lookup_value__";

type LookupSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  items: LookupItem[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  clearLabel?: string;
};

function formatLookupLabel(item: LookupItem) {
  return item.code ? `${item.code} - ${item.name}` : item.name || item.id;
}

export function LookupSelect({
  id,
  value,
  onChange,
  items,
  placeholder = "Select",
  loading = false,
  disabled = false,
  clearable = true,
  clearLabel = "Clear selection",
}: LookupSelectProps) {
  const selected = items.find((item) => item.id === value);
  // Only pass a value Radix can resolve to an option. Passing an unmatched id
  // makes the hidden native <select> emit "" and wipe react-hook-form.
  const selectValue = selected ? value : undefined;
  const label = selected ? formatLookupLabel(selected) : undefined;

  return (
    <Select
      key={
        selected
          ? `selected-${value}`
          : `pending-${value || "empty"}-${items.length}`
      }
      value={selectValue}
      onValueChange={(nextValue) => {
        if (nextValue === CLEAR_LOOKUP_VALUE) {
          onChange("");
          return;
        }
        // Ignore empty emissions caused by unmatched controlled values.
        if (!nextValue) {
          return;
        }
        onChange(nextValue);
      }}
      disabled={disabled || loading}
    >
      <SelectTrigger id={id} className="w-full min-w-0">
        <SelectValue placeholder={loading ? "Loading..." : placeholder}>
          {label}
        </SelectValue>
      </SelectTrigger>

      <SelectContent
        position="popper"
        align="start"
        className="min-w-[var(--radix-select-trigger-width)]"
      >
        {clearable ? (
          <>
            <SelectItem
              value={CLEAR_LOOKUP_VALUE}
              className="text-muted-foreground"
            >
              {clearLabel}
            </SelectItem>
            <SelectSeparator />
          </>
        ) : null}
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {formatLookupLabel(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
