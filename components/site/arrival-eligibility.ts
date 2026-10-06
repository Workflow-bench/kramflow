/**
 * Pure decisions for the first-entry arrival sequence, kept free of DOM and React so
 * they can be tested directly.
 *
 * The rule is deliberately narrow: play once per browser session, only for a visitor
 * arriving at the top of the homepage through a normal navigation. Anything else — a
 * deep link, restored scroll, back/forward, reduced motion, a session that already saw
 * it — shows the settled page immediately.
 */

export const ARRIVAL_STORAGE_KEY = "kf-arrival-v1";

export interface ArrivalInput {
  /** The stored flag, or null when absent or storage is unavailable. */
  stored: string | null;
  /** `performance.getEntriesByType("navigation")[0]?.type`, if known. */
  navigationType: string | undefined;
  scrollY: number;
  hash: string;
  reducedMotion: boolean;
}

export function arrivalEligible(input: ArrivalInput): boolean {
  if (input.reducedMotion) return false;
  if (input.stored === "1") return false;
  if (input.navigationType === "back_forward" || input.navigationType === "reload") return false;
  if (input.hash) return false;
  if (input.scrollY > 4) return false;
  return true;
}

/** Storage access that tolerates denial, private modes and quota errors. */
export function readArrivalFlag(storage: Pick<Storage, "getItem"> | null | undefined): string | null {
  try {
    return storage ? storage.getItem(ARRIVAL_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

export function writeArrivalFlag(storage: Pick<Storage, "setItem"> | null | undefined): void {
  try {
    storage?.setItem(ARRIVAL_STORAGE_KEY, "1");
  } catch {
    // Denied storage: the sequence simply plays again next time. Nothing else depends on it.
  }
}
