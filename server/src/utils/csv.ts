/**
 * OWASP CSV Formula Injection Defense + RFC 4180 cell quoting.
 * Prefixes leading `=`, `+`, `-`, `@`, `\t`, `\r` with a single quote so spreadsheet apps
 * never execute untrusted strings as formulas.
 */
export function csvSafeCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  str = str.replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toUtf8BomCsv(rows: unknown[][]): string {
  const lines = rows.map((row) => row.map(csvSafeCell).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}
