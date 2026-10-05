"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;

  value?: number | null;

  onChange(value: number): void;

  min?: number;

  max?: number;

  step?: number;

  disabled?: boolean;
}

export function NumericField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">

      <Label>
        {label}
      </Label>

      <Input
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) =>
          onChange(
            Number(e.target.value),
          )
        }
      />

    </div>
  );
}