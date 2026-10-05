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

const OWNER_TYPES = [
  {
    value: "DEPARTMENT",
    label: "Department",
    hint: "This department owns the work",
  },
  {
    value: "EMPLOYEE",
    label: "Employee",
    hint: "New hire completes this",
  },
  {
    value: "MANAGER",
    label: "Manager",
    hint: "Reporting manager completes this",
  },
] as const;

export function OwnerTypeSelect({ value, onChange }: Props) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select owner" />
      </SelectTrigger>
      <SelectContent>
        {OWNER_TYPES.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <div className="flex flex-col items-start">
              <span>{item.label}</span>
              <span className="text-muted-foreground text-xs">{item.hint}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function formatOwnerTypeLabel(value?: string | null): string {
  if (!value) return "—";
  const match = OWNER_TYPES.find((item) => item.value === value);
  return match?.label ?? value;
}
