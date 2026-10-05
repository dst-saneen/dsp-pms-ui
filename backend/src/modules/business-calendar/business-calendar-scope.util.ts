/**
 * Server-generated scope keys (work order §6.2).
 * COMPANY:<companyUuid> | BRANCH:<branchUuid>
 */
export function buildBusinessCalendarScopeKey(
  scope: string,
  officeId: string,
): string {
  const id = officeId?.trim();
  if (!id) {
    throw new Error('officeId is required for calendar scope key');
  }

  if (scope === 'COMPANY') {
    return `COMPANY:${id}`;
  }

  if (scope === 'BRANCH') {
    return `BRANCH:${id}`;
  }

  throw new Error(`Unsupported calendar scope: ${String(scope)}`);
}

export function parseBusinessCalendarScopeKey(scopeKey: string): {
  scope: 'COMPANY' | 'BRANCH';
  officeId: string;
} {
  const value = scopeKey?.trim();
  const match = /^(COMPANY|BRANCH):(.+)$/.exec(value ?? '');
  if (!match) {
    throw new Error('Invalid business calendar scope key');
  }
  return {
    scope: match[1] as 'COMPANY' | 'BRANCH',
    officeId: match[2],
  };
}
