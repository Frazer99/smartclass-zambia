/**
 * Minimal, dependency-free CSV export — no new package added (no
 * papaparse, no xlsx). A progress export is a handful of flat columns;
 * a real CSV library buys correctness for edge cases (embedded commas,
 * newlines within a field, exotic encodings) this data will never hit —
 * topic names, percentages, and dates don't contain quote marks or line
 * breaks. Handles the one real edge case that matters (a value containing
 * a comma or quote) with standard CSV quoting, nothing more.
 */

function escapeCsvValue(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCsvValue).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(','));
  }
  return lines.join('\n');
}

/** Triggers a browser download of the given CSV content — works in every
 *  modern browser via a Blob + temporary object URL, no server round-trip
 *  needed since the pupil/admin already has the data client-side. */
export function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
