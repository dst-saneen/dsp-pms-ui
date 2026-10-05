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
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { isAnonymousPublicPath } from "@/config/public-routes";
import { authService } from "@/services/auth.service";
import type { AuthResponse, AuthUser, OrganizationScopeSelection } from "@/types/auth";

type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (
    identifier: string,
    password: string,
    scope?: OrganizationScopeSelection
  ) => Promise<AuthUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthUser>;
  completeAuthentication: (response: AuthResponse) => void;
  /** Reload /auth/me into context (ORG-04 — post-setup employee link, roles). */
  refreshSession: () => Promise<AuthUser>;
  changeContext: (companyId?: string, branchId?: string, companyGroupId?: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const skipSessionRestore = isAnonymousPublicPath(pathname);
  const [status, setStatus] = useState<AuthStatus>(() =>
    skipSessionRestore ? "unauthenticated" : "initializing"
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  // A Strict Mode effect replay must observe the first restore result without
  // issuing a second refresh-token rotation request.
  const restorePromiseRef = useRef<Promise<AuthResponse> | null>(null);
  const restoreAfterAnonymousRouteRef = useRef(skipSessionRestore);
  const restoreGenerationRef = useRef(0);

  const clearAuthentication = useCallback(
    (options?: { clearQueries?: boolean }) => {
      restoreGenerationRef.current += 1;
      setUser(null);
      setStatus("unauthenticated");
      if (options?.clearQueries !== false) {
        queryClient.clear();
      }
    },
    [queryClient]
  );

  useEffect(() => {
    const handleExpired = () => clearAuthentication();
    window.addEventListener("erp:auth-expired", handleExpired);

    return () => {
      window.removeEventListener("erp:auth-expired", handleExpired);
    };
  }, [clearAuthentication]);

  useEffect(() => {
    if (skipSessionRestore) {
      restoreGenerationRef.current += 1;
      restoreAfterAnonymousRouteRef.current = true;
      // Route visibility is the external state synchronized by this provider.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(null);
      setStatus("unauthenticated");
      return;
    }

    if (status !== "initializing") {
      if (restoreAfterAnonymousRouteRef.current) {
        restoreAfterAnonymousRouteRef.current = false;
        // An SPA transition from an anonymous page needs the same one-time
        // session restoration as an initial protected document load.
        setStatus("initializing");
      }
      return;
    }

    restoreAfterAnonymousRouteRef.current = false;
    let active = true;
    const restoreGeneration = restoreGenerationRef.current;

    let restorePromise = restorePromiseRef.current;
    if (!restorePromise) {
      restorePromise = authService.restore();
      restorePromiseRef.current = restorePromise;
      void restorePromise.then(
        () => {
          if (restorePromiseRef.current === restorePromise) {
            restorePromiseRef.current = null;
          }
        },
        () => {
          if (restorePromiseRef.current === restorePromise) {
            restorePromiseRef.current = null;
          }
        }
      );
    }

    void restorePromise
      .then((response) => {
        if (!active || restoreGenerationRef.current !== restoreGeneration) return;
        setUser(response.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (!active || restoreGenerationRef.current !== restoreGeneration) return;
        // Do not clear in-flight public queries when a guest has no session.
        clearAuthentication({ clearQueries: false });
      });

    return () => {
      active = false;
    };
  }, [clearAuthentication, skipSessionRestore, status]);

  const login = useCallback(
    async (identifier: string, password: string, scope?: OrganizationScopeSelection) => {
      const response = await authService.login(identifier, password, scope);
      restoreGenerationRef.current += 1;
      restoreAfterAnonymousRouteRef.current = false;
      setUser(response.user);
      setStatus("authenticated");
      return response.user;
    },
    []
  );

  const completeAuthentication = useCallback((response: AuthResponse) => {
    restoreGenerationRef.current += 1;
    restoreAfterAnonymousRouteRef.current = false;
    setUser(response.user);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearAuthentication();
    }
  }, [clearAuthentication]);

  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      clearAuthentication();
    }
  }, [clearAuthentication]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const response = await authService.changePassword(currentPassword, newPassword);
    restoreGenerationRef.current += 1;
    restoreAfterAnonymousRouteRef.current = false;
    setUser(response.user);
    setStatus("authenticated");
    return response.user;
  }, []);

  const refreshSession = useCallback(async () => {
    const nextUser = await authService.me();
    restoreGenerationRef.current += 1;
    setUser(nextUser);
    setStatus("authenticated");
    return nextUser;
  }, []);

  const changeContext = useCallback(
    async (companyId?: string, branchId?: string, companyGroupId?: string) => {
      const response = await authService.changeContext(companyId, branchId, companyGroupId);
      restoreGenerationRef.current += 1;
      queryClient.clear();
      setUser(response.user);
    },
    [queryClient]
  );

  const hasPermission = useCallback(
    (permission: string) =>
      Boolean(
        user?.authorization.isGlobal ||
        user?.authorization.permissions.includes("platform.admin") ||
        user?.authorization.permissions.includes(permission)
      ),
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      logoutAll,
      changePassword,
      completeAuthentication,
      refreshSession,
      changeContext,
      hasPermission,
    }),
    [
      status,
      user,
      login,
      logout,
      logoutAll,
      changePassword,
      completeAuthentication,
      refreshSession,
      changeContext,
      hasPermission,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
