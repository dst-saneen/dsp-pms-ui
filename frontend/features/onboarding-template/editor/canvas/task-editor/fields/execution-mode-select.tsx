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

const MODES = [
  {
    value: "SYSTEM",
    label: "System",
  },
  {
    value: "DEPARTMENT",
    label: "Department Queue",
  },
  {
    value: "DESIGNATION",
    label: "Specific Designation",
  },
  {
    value: "EMPLOYEE",
    label: "Specific Employee",
  },
];

export function ExecutionModeSelect({
  value,
  onChange,
}: Props) {
  return (
    <Select
      value={value ?? "DEPARTMENT"}
      onValueChange={onChange}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {MODES.map((mode) => (
          <SelectItem
            key={mode.value}
            value={mode.value}
          >
            {mode.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}