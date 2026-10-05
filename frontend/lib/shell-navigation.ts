import { navigation } from "@/config/navigation";
import type { NavigationGroup, NavigationItem } from "@/types/navigation";

export type ShellCrumb = {
  label: string;
  href: string | null;
};

function flattenItems(
  items: NavigationItem[],
  parents: NavigationItem[] = []
): Array<{ item: NavigationItem; parents: NavigationItem[] }> {
  return items.flatMap((item) => {
    const current = [...parents, item];
    const self = item.href ? [{ item, parents }] : [];
    const children = item.children
      ? flattenItems(item.children, current)
      : [];
    return [...self, ...children];
  });
}

export function findNavMatch(pathname: string): {
  group: NavigationGroup;
  item: NavigationItem;
  parents: NavigationItem[];
} | null {
  let best: {
    group: NavigationGroup;
    item: NavigationItem;
    parents: NavigationItem[];
    score: number;
  } | null = null;

  for (const group of navigation) {
    for (const entry of flattenItems(group.items)) {
      if (!entry.item.href) continue;
      if (
        pathname === entry.item.href ||
        pathname.startsWith(`${entry.item.href}/`)
      ) {
        const score = entry.item.href.length;
        if (!best || score > best.score) {
          best = { group, item: entry.item, parents: entry.parents, score };
        }
      }
    }
  }

  return best
    ? { group: best.group, item: best.item, parents: best.parents }
    : null;
}

export function getPageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Dashboard";
  const match = findNavMatch(pathname);
  return match?.item.title ?? "Dashboard";
}

export function getBreadcrumbs(pathname: string): ShellCrumb[] | null {
  const match = findNavMatch(pathname);
  if (!match) return null;

  const crumbs: ShellCrumb[] = [
    { label: match.group.title, href: null },
    ...match.parents.map((parent) => ({
      label: parent.title,
      href: parent.href ?? null,
    })),
    {
      label: match.item.title,
      // List item becomes a link when entity crumbs append (create/edit/detail).
      href: match.item.href ?? null,
    },
  ];

  if (crumbs.length <= 2 && pathname === "/dashboard") {
    return null;
  }

  return crumbs;
}

/** Merge nav crumbs with page-published entity crumbs (UX-03). */
export function mergeEntityBreadcrumbs(
  navCrumbs: ShellCrumb[] | null,
  entityCrumbs: ShellCrumb[],
): ShellCrumb[] | null {
  if (!entityCrumbs.length) {
    if (!navCrumbs) return null;
    // On list pages, the leaf should not be a self-link.
    return navCrumbs.map((crumb, index) =>
      index === navCrumbs.length - 1 ? { ...crumb, href: null } : crumb,
    );
  }

  if (!navCrumbs) {
    return entityCrumbs;
  }

  return [...navCrumbs, ...entityCrumbs];
}
