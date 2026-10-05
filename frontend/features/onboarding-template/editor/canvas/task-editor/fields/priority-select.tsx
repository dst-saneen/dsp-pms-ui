"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value?: number | null;

  onChange(value: number): void;
}

const PRIORITIES = [
  {
    value: 1,
    label: "Low",
  },
  {
    value: 2,
    label: "Medium",
  },
  {
    value: 3,
    label: "High",
  },
  {
    value: 4,
    label: "Critical",
  },
];

export function PrioritySelect({
  value,
  onChange,
}: Props) {
  return (
    <Select
      value={String(value ?? 2)}
      onValueChange={(value) =>
        onChange(Number(value))
      }
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {PRIORITIES.map((priority) => (
          <SelectItem
            key={priority.value}
            value={String(priority.value)}
          >
            {priority.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}