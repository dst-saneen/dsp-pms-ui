"use client";

import { useEffect, useCallback } from "react";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  /** Browser tab close / refresh message (browsers may show a generic dialog). */
  message?: string;
}

/**
 * Warn on tab close when the form is dirty, and expose confirmLeave() for
 * Cancel / Back buttons (in-app route blockers are not universal in App Router).
 */
export function useUnsavedChanges({
  isDirty,
  message = "You have unsaved changes. Leave this page?",
}: UseUnsavedChangesOptions) {
  useEffect(() => {
    if (!isDirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = message;
      return message;
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, message]);

  const confirmLeave = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(message);
  }, [isDirty, message]);

  return { confirmLeave };
}
