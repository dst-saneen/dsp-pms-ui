"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { ShellCrumb } from "@/lib/shell-navigation";

type EntityBreadcrumbContextValue = {
  entityCrumbs: ShellCrumb[];
  setEntityCrumbs: (crumbs: ShellCrumb[]) => void;
  clearEntityCrumbs: () => void;
};

const EntityBreadcrumbContext =
  createContext<EntityBreadcrumbContextValue | null>(null);

export function EntityBreadcrumbProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [entityCrumbs, setEntityCrumbsState] = useState<ShellCrumb[]>([]);

  const setEntityCrumbs = useCallback((crumbs: ShellCrumb[]) => {
    setEntityCrumbsState(crumbs);
  }, []);

  const clearEntityCrumbs = useCallback(() => {
    setEntityCrumbsState([]);
  }, []);

  const value = useMemo(
    () => ({ entityCrumbs, setEntityCrumbs, clearEntityCrumbs }),
    [entityCrumbs, setEntityCrumbs, clearEntityCrumbs],
  );

  return (
    <EntityBreadcrumbContext.Provider value={value}>
      {children}
    </EntityBreadcrumbContext.Provider>
  );
}

function useEntityBreadcrumbContext() {
  const ctx = useContext(EntityBreadcrumbContext);
  if (!ctx) {
    throw new Error(
      "Entity breadcrumb hooks require EntityBreadcrumbProvider",
    );
  }
  return ctx;
}

/** Read entity crumbs for the shell header. Safe outside provider → empty. */
export function useEntityBreadcrumbs(): ShellCrumb[] {
  const ctx = useContext(EntityBreadcrumbContext);
  return ctx?.entityCrumbs ?? [];
}

function crumbsKey(crumbs: ShellCrumb[]) {
  return crumbs.map((crumb) => `${crumb.label}\0${crumb.href ?? ""}`).join("\n");
}

/**
 * Publish entity crumbs for the current page. Clears on unmount.
 * Example: `[{ label: "New Designation", href: null }]`
 */
export function useSetEntityBreadcrumbs(crumbs: ShellCrumb[]) {
  const { setEntityCrumbs, clearEntityCrumbs } = useEntityBreadcrumbContext();
  const key = crumbsKey(crumbs);
  const latestRef = useRef(crumbs);

  useEffect(() => {
    latestRef.current = crumbs;
  }, [crumbs]);

  useEffect(() => {
    setEntityCrumbs(latestRef.current);
    return () => {
      clearEntityCrumbs();
    };
  }, [key, setEntityCrumbs, clearEntityCrumbs]);
}
