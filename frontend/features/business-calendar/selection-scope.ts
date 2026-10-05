export function getScopedSelectionId(
  selectedId: string,
  availableItems: ReadonlyArray<{ id: string }>
): string {
  return availableItems.some((item) => item.id === selectedId) ? selectedId : "";
}
