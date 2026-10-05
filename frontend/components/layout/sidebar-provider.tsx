"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SidebarVersion = "v1" | "v2";

const SIDEBAR_VERSION_STORAGE_KEY = "group-erp.sidebar-version";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  version: SidebarVersion;
  setVersion: (version: SidebarVersion) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [version, setVersionState] = useState<SidebarVersion>("v1");

  useEffect(() => {
    try {
      const savedVersion = window.localStorage.getItem(SIDEBAR_VERSION_STORAGE_KEY);
      if (savedVersion === "v1" || savedVersion === "v2") {
        // Browser storage is the external source synchronized by this effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVersionState(savedVersion);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  const setVersion = useCallback((nextVersion: SidebarVersion) => {
    setVersionState(nextVersion);
    try {
      window.localStorage.setItem(SIDEBAR_VERSION_STORAGE_KEY, nextVersion);
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
  }, []);

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
      mobileOpen,
      setMobileOpen,
      version,
      setVersion,
    }),
    [collapsed, mobileOpen, setVersion, toggleCollapsed, version]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }

  return context;
}
