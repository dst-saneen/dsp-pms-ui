"use client";

interface Props {
  value: string;
  onChange(value: string): void;
}

export function TextRenderer({
  value,
  onChange,
}: Props) {
  return (
    <input
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
    />
  );
}