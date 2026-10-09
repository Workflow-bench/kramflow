import { ARRIVAL_STORAGE_KEY } from "./arrival-eligibility";

/**
 * Runs before the browser paints a single pixel of the server-rendered HTML — an
 * ordinary inline `<script>`, which blocks parsing and executes where it sits, placed
 * as the first thing in the page body (see app/page.tsx) so it runs before the hero
 * it's covering even paints.
 *
 * It is a cheap, optimistic approximation of arrival-eligibility.ts's real check: the
 * storage key is imported from there (not retyped, so the two cannot drift on the key
 * itself), and the conditions mirror the same rule (reduced motion, already seen this
 * session, a restored navigation, a hash, a non-zero scroll position) using only
 * synchronous browser APIs. Arrival.tsx then runs the full check in a layout effect,
 * before paint, and removes this class at once if the optimistic guess was wrong — see
 * that component's own comment for the complete account of why two classes, not one.
 *
 * Never throws: storage and matchMedia can both be denied or unavailable, and a
 * visitor must never be left looking at a broken page because this guess failed.
 */
const BOOT_SCRIPT = `(function(){try{
  var k=${JSON.stringify(ARRIVAL_STORAGE_KEY)};
  var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var seen=window.sessionStorage&&window.sessionStorage.getItem(k)==="1";
  var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];
  var navType=nav&&nav.type;
  var restored=navType==="back_forward"||navType==="reload";
  if(!reduced&&!seen&&!restored&&!location.hash&&window.scrollY<=4){
    document.documentElement.classList.add("arrival-boot");
  }
}catch(e){}})();`;

export function ArrivalBootScript() {
  return <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />;
}
