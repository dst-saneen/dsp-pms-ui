const FORMULA_GUARD_RE = /^[\t\r ]*[=+\-@\t\r]/;

/**
 * Escape a CSV cell for spreadsheet-safe export.
 * Normalizes CR/LF, guards formula injection, and quotes delimiters.
 * Number values are emitted as plain numeric text (server-generated columns).
 */
export function csvEscapeCell(
  value: string | number | null | undefined,
): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return '';
    }
    return String(value);
  }

  let cell = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  if (FORMULA_GUARD_RE.test(cell) || cell.startsWith('\n')) {
    cell = `'${cell}`;
  }

  if (/[",\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}
