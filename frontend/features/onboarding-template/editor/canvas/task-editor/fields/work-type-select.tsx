"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  value: string;
  onChange(value: string): void;
}

const WORK_TYPES = [
  {
    value: "CHECKLIST",
    label: "Checklist",
    hint: "Normal onboarding step",
  },
  {
    value: "ASSET",
    label: "Asset",
    hint: "Issue laptop, ID card, licence, etc.",
  },
] as const;

export function WorkTypeSelect({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select work type" />
      </SelectTrigger>
      <SelectContent>
        {WORK_TYPES.map((item) => (
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
