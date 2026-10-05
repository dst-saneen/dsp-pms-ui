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
