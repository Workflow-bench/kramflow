export type Tier = "free" | "pro";

const DEFAULT_TIER: Tier = "free";

// How many events an account may own at once, keyed by tier. This is a
// resource-count ceiling, not a request-rate limiter (see rate-limit.ts
// for that) — it guards against an account accumulating an unbounded
// number of event rows, whether from real usage growing past what a
// single operator plausibly runs concurrently, or from scripted abuse of
// the create-event endpoint.
//
// free: 3 — one event covers "this year's show," a second covers overlap
// with a wrapping-up previous event or an early draft of next year's, and
// a third leaves room for a one-off test/practice event without forcing a
// delete first. Generous for genuine single-organization use, low enough
// to rule out someone scripting dozens of empty events.
//
// pro: 25 — "pro" isn't a purchasable tier yet (see profiles.tier and the
// migration that added it — this is billing groundwork, not billing
// itself), but the number is real from day one: comfortably above what
// even an agency-style operator running many client events concurrently
// would need, while still being a defined ceiling rather than
// "unlimited" — every tier keeps *some* cap for platform health. Raising
// it later, or adding a new tier, is a one-line change here with no
// schema migration.
export const TIER_EVENT_LIMITS: Record<Tier, number> = {
  free: 3,
  pro: 25,
};

function isTier(value: unknown): value is Tier {
  return value === "free" || value === "pro";
}

// Reads from a DB column the API route doesn't fully control (a row this
// code didn't insert, a future tier value added to the CHECK constraint
// before this map is updated) — falls back to the strictest known tier
// rather than defaulting open.
export function eventLimitForTier(tier: unknown): number {
  return TIER_EVENT_LIMITS[isTier(tier) ? tier : DEFAULT_TIER];
}
