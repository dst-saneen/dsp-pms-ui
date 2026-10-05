"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value?: string | null;
  onChange(value: string): void;
}

const TYPES = [
  "NONE",
  "DOCUMENT",
  "FORM",
  "COURSE",
  "URL",
  "RESOURCE",
];

export function ReferenceTypeSelect({
  value,
  onChange,
}: Props) {
  return (
    <Select
      value={value ?? "NONE"}
      onValueChange={onChange}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>

        {TYPES.map((item) => (
          <SelectItem
            key={item}
            value={item}
          >
            {item}
          </SelectItem>
        ))}

      </SelectContent>

    </Select>
  );
}