/**
 * The quiet beat.
 *
 * Two earlier versions of this section were wrong in opposite ways. The
 * first hand-drew a "CURRENT / NEXT / ON DECK" strip in markup — a DOM
 * recreation of a product view, carrying copy from a different event than
 * every screenshot on the page. The second replaced it with three rows of
 * icon + heading + paragraph, which is the container pattern used as page
 * structure: the most reliable tell that a layout was assembled rather
 * than composed.
 *
 * This is neither. It is the only section on the page with no product
 * visual and no repeated unit — a single statement set large, with the
 * three guarantees running underneath it as one continuous line of
 * operational metadata rather than three cards. After the pinned hero
 * push-in and the pinned cue timeline, the page needs somewhere that
 * asks nothing of the reader, and the argument here is verbal anyway.
 *
 * It is also a server component: no state, no effects, no motion, so
 * nothing about it needs to reach the client.
 */

const GUARANTEES = [
  ["Control lease", "One operator drives. Everyone else sees the same state and cannot advance it by accident."],
  ["Shared truth", "The booth and the speaker ready room read the live show, not a screenshot of it from an hour ago."],
  ["Activity log", "Who advanced the cue, who held it, who pushed the alert, and when."],
];

export function LiveOperationsSection() {
  return (
    <section className="border-b border-line-soft">
      <div className="mx-auto max-w-[1280px] px-6 py-28 sm:px-10 lg:py-40">
        <h2 className="max-w-[15ch] font-display text-[clamp(2.25rem,6vw,5rem)] text-primary">
          Built for the minute it goes wrong.
        </h2>

        <p className="mt-10 max-w-[58ch] text-lg leading-relaxed text-muted">
          A show does not fail because nobody knew the plan. It fails because the plan changed and the room found out
          late — and then two people tried to fix it at once.
        </p>

        <dl className="mt-20 grid grid-cols-1 gap-y-8 border-t border-line-soft pt-8 sm:grid-cols-3 sm:gap-x-10">
          {GUARANTEES.map(([term, detail]) => (
            <div key={term}>
              <dt className="tnum text-[11px] uppercase tracking-[0.2em] text-muted-2">{term}</dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-muted">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
