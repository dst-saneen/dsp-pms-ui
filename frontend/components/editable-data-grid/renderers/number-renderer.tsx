"use client";

interface Props {
  value: number;
  onChange(value: number): void;
}

export function NumberRenderer({
  value,
  onChange,
}: Props) {
  return (
    <input
      type="number"
      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      value={value}
      onChange={(e) =>
        onChange(Number(e.target.value))
      }
    />
  );
}