"use client";

import { LookupSelect } from "@/components/forms/lookup-select";
import type {
  LookupItem,
} from "@/features/lookups/types/lookup";

interface Props {
  value: string;
  items: LookupItem[];
  onChange(value: string): void;
}

export function LookupRenderer({
  value,
  items,
  onChange,
}: Props) {
  return (
    <LookupSelect
      value={value}
      items={items}
      onChange={onChange}
    />
  );
}