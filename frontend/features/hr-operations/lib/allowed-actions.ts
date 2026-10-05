export function createOperationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function hasAllowedAction<T extends string>(
  actions: readonly T[] | undefined,
  action: T,
): boolean {
  return Boolean(actions?.includes(action));
}

export function actorLabel(actor: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  employeeCode?: string | null;
} | null | undefined): string {
  if (!actor) return "—";
  const name = actor.displayName ?? [actor.firstName, actor.lastName].filter(Boolean).join(" ");
  return name || actor.employeeCode || "—";
}

export function displayDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}
