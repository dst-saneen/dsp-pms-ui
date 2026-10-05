export function splitOwnerDisplayName(
  displayName?: string | null,
  username?: string | null,
): { firstName: string; lastName: string | null } {
  const source =
    displayName?.trim() || username?.trim() || 'Organization Owner';
  const [firstName, ...rest] = source.split(/\s+/).filter(Boolean);

  return {
    firstName: firstName || 'Owner',
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
}
