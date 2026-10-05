"use client";

import { useCallback, useSyncExternalStore } from "react";

const COMPANY_KEY = "business-calendar:companyId";
const BRANCH_KEY = "business-calendar:branchId";
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readKey(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeKey(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // ignore quota / private mode
  }
  emit();
}

/** Keeps company selection when switching Business Calendar tabs. */
export function usePersistedCompanyId() {
  const companyId = useSyncExternalStore(
    subscribe,
    () => readKey(COMPANY_KEY),
    () => "",
  );

  const setCompanyId = useCallback((value: string) => {
    writeKey(COMPANY_KEY, value);
    if (!value) writeKey(BRANCH_KEY, "");
  }, []);

  return { companyId, setCompanyId, ready: true };
}

/** Optional branch filter (Preview). Cleared when company changes. */
export function usePersistedBranchId(companyId: string) {
  const storedBranchId = useSyncExternalStore(
    subscribe,
    () => readKey(BRANCH_KEY),
    () => "",
  );
  const branchId = companyId ? storedBranchId : "";

  const setBranchId = useCallback((value: string) => {
    writeKey(BRANCH_KEY, value);
  }, []);

  return { branchId, setBranchId, ready: true };
}
