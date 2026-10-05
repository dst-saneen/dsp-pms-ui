import { csvEscapeCell } from './csv-safe';

describe('csvEscapeCell', () => {
  it('returns empty string for nullish values', () => {
    expect(csvEscapeCell(null)).toBe('');
    expect(csvEscapeCell(undefined)).toBe('');
  });

  it('stringifies finite numbers without formula guarding', () => {
    expect(csvEscapeCell(42)).toBe('42');
    expect(csvEscapeCell(-12.5)).toBe('-12.5');
    expect(csvEscapeCell(Number.NaN)).toBe('');
  });

  it('prefixes formula-like cells', () => {
    expect(csvEscapeCell('=1+1')).toBe("'=1+1");
    expect(csvEscapeCell('+cmd')).toBe("'+cmd");
    expect(csvEscapeCell('-2+3')).toBe("'-2+3");
    expect(csvEscapeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvEscapeCell('\t=1+1')).toBe("'\t=1+1");
  });

  it('guards leading whitespace before formula characters', () => {
    expect(csvEscapeCell(' =1+1')).toBe("' =1+1");
    expect(csvEscapeCell('  +HYPERLINK')).toBe("'  +HYPERLINK");
    expect(csvEscapeCell('\t @x')).toBe("'\t @x");
  });

  it('escapes quotes, commas, and newlines', () => {
    expect(csvEscapeCell('a,b')).toBe('"a,b"');
    expect(csvEscapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscapeCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('normalizes CR and CRLF to LF before escaping', () => {
    expect(csvEscapeCell('a\r\nb')).toBe('"a\nb"');
    expect(csvEscapeCell('a\rb')).toBe('"a\nb"');
  });

  it('guards and quotes formula cells that also need CSV quoting', () => {
    expect(csvEscapeCell('=cmd,"x"')).toBe(`"'=cmd,""x"""`);
  });

  it('leaves plain text unchanged', () => {
    expect(csvEscapeCell('Acme Corp')).toBe('Acme Corp');
  });
});
