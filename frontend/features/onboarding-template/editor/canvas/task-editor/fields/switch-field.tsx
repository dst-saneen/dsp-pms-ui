"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  label: string;

  checked: boolean;

  onChange(value: boolean): void;

  description?: string;

  disabled?: boolean;
}

export function SwitchField({
  label,
  checked,
  onChange,
  description,
  disabled,
}: Props) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">

      <div className="space-y-1">

        <Label>
          {label}
        </Label>

        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}

      </div>

      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />

    </div>
  );
}