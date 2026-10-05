import type { NavigationItem } from "@/types/navigation";

function getNavigationHrefs(items: NavigationItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children ? getNavigationHrefs(item.children) : []),
  ]);
}

export function navigationRouteMatches(pathname: string, href?: string) {
  if (!href || href === "#") return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveNavigationHref(
  pathname: string,
  items: NavigationItem[]
): string | undefined {
  return getNavigationHrefs(items)
    .filter((href) => navigationRouteMatches(pathname, href))
    .sort((left, right) => right.length - left.length)[0];
}
