export function hasAllowedAction<T extends string>(
  actions: readonly T[] | undefined,
  action: T,
): boolean {
  return Boolean(actions?.includes(action));
}
