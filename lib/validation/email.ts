// Shared, provably linear-time email sanity check for the auth routes
// (signup/resend, and a length-only guard on login — see each call site).
// Replaces a single combined regex, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, that
// GitHub Advanced Security (CodeQL js/polynomial-redos) flagged as
// super-linear on adversarial input: its middle and trailing [^\s@]+
// groups both accept '.', so on a non-matching string (e.g. many repeated
// '.' with no valid final label) the backtracking engine could try every
// possible split point between those two groups before concluding
// failure — the classic "two adjacent quantified groups over overlapping
// characters" ReDoS shape.
//
// This fixes that by never letting two quantifiers compete over the same
// characters: split on '@' first (a plain, non-regex indexOf/lastIndexOf
// scan), then run one small, non-overlapping regex per side. Each of
// those regexes has exactly one quantifier bounded by anchors with
// nothing ambiguous on either side of it, so every check here — the length
// guard, the indexOf/lastIndexOf/split calls, and each regex — is a single
// linear pass with no backtracking, regardless of input shape.
//
// Deliberately not a full RFC 5322 parser (the RFC's own grammar allows
// quoted strings, comments, and other syntax essentially never seen in a
// real signup form) — this is the same practical "local@domain.tld"
// shape the old regex targeted, just checked without the ambiguity that
// made it unsafe.

// RFC 5321 §4.5.3.1.3 — the actual protocol-level maximum, not a number
// invented for this fix. Checked before any regex runs, so an
// attacker-supplied string is bounded before it reaches pattern matching
// at all.
export const MAX_EMAIL_LENGTH = 254;

// No '@', no whitespace, non-empty — safe as a lone anchored quantifier.
const LOCAL_PART_RE = /^[^\s@]+$/;
// No '@', whitespace, or '.' — each dot-separated domain label is checked
// individually instead of one regex spanning the whole domain, which is
// exactly the piece that made the original pattern ambiguous.
const DOMAIN_LABEL_RE = /^[^\s@.]+$/;

export function isValidEmail(value: string): boolean {
  if (value.length === 0 || value.length > MAX_EMAIL_LENGTH) return false;

  const at = value.indexOf("@");
  // Exactly one '@', with a non-empty local part before it.
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (!LOCAL_PART_RE.test(local)) return false;

  // Domain needs at least one '.' (i.e. at least two labels — rejects a
  // bare "foo@bar" with no TLD), not leading/trailing, and every label
  // between the dots non-empty and free of '@'/whitespace/further dots.
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  const labels = domain.split(".");
  return labels.length >= 2 && labels.every((label) => label.length > 0 && DOMAIN_LABEL_RE.test(label));
}
