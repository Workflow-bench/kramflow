// Six-digit TV code helpers shared by the server (app/api/tv/connect) and
// the client (the /tv form, the Share Display card). No server-only imports:
// this file only shapes and validates strings, it never generates or looks
// anything up.

export const TV_CODE_LENGTH = 6;

// Accepts what a person actually types or pastes: digits, optionally with
// spaces between them ("482 731", "482731"). Anything else, including
// letters, symbols, or the wrong number of digits, is rejected. The length
// cap runs before the regex so a huge pasted string is never scanned.
export function normalizeTvCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 32) return null;
  const compact = input.replace(/\s+/g, "");
  return /^[0-9]{6}$/.test(compact) ? compact : null;
}

// "482731" -> "482 731". Display only; the stored and submitted value is
// always the plain six digits.
export function formatTvCode(code: string): string {
  return code.length === TV_CODE_LENGTH ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
