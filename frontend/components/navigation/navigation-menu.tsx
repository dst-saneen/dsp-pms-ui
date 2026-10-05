import { navigation } from "@/config/navigation";

import { NavigationGroup } from "./navigation-group";

export function NavigationMenu() {
  return (
    <nav className="flex flex-col gap-6">
      {navigation.map((group) => (
        <NavigationGroup
          key={group.title}
          group={group}
        />
      ))}
    </nav>
  );
}