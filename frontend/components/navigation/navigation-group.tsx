import type { NavigationGroup as NavigationGroupType } from "@/types/navigation";

import { NavigationItem } from "./navigation-item";

interface NavigationGroupProps {
  group: NavigationGroupType;
}

export function NavigationGroup({
  group,
}: NavigationGroupProps) {
  return (
    <div className="space-y-2">
      <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.title}
      </h4>

      <div className="space-y-1">
        {group.items.map((item) => (
          <NavigationItem
            key={item.title}
            item={item}
          />
        ))}
      </div>
    </div>
  );
}