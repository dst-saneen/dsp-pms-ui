import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LookupItem } from "../types";

interface LookupSelectProps {
  placeholder: string;
  items: LookupItem[];
  loading?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export function LookupSelect({
  placeholder,
  items,
  value,
  onChange,
}: LookupSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      <SelectContent>
        {items.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
          >
            {item.code
              ? `${item.code} - ${item.name}`
              : item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}