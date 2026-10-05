"use client";

interface Props {
  value: boolean;
  onChange(value: boolean): void;
}

export function CheckboxRenderer({
  value,
  onChange,
}: Props) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) =>
        onChange(e.target.checked)
      }
    />
  );
}