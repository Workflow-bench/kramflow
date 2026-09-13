import type { CSSProperties, ReactNode } from "react";

/**
 * A restrained phone frame for the Remote capture.
 *
 * Adapted from the `product-mockup` skill's "iPhone / Smartphone Frame"
 * pattern, with the same departure the browser AppWindow made from its
 * reference: strip the parts that read as generated-template decoration
 * and keep only what tells a viewer "this is a physical device."
 *
 * - **No dynamic island / notch cutout shaped like a specific device.**
 *   The skill's reference draws a 100×28px black pill positioned like an
 *   iPhone's sensor housing — a detail that dates the mockup to one
 *   product generation and reads as "stock phone graphic" the moment it's
 *   recognised. A plain centred speaker line does the same job (this is
 *   a phone, held near an ear) without borrowing anyone's hardware design.
 * - **No side buttons, no metallic edge highlight.** Both are the
 *   skeuomorphic detailing this project has repeatedly ruled out for the
 *   venue-screen captures, for the same reason: they shrink the actual
 *   pixels to make room for decoration.
 * - **Bezel drawn from the app's own tokens** (`border-line`, `bg-card`),
 *   so the frame reads as Kramflow material rather than a borrowed asset.
 *
 * This is the one capture that is genuinely a device rather than a
 * screen or a window — the Remote is what an operator holds, not what a
 * room looks at — which is why it alone gets rounded hardware treatment.
 *
 * **`flex flex-col` internally, not percentage heights.** The first
 * version's screen slot had no explicit height and relied on the child
 * image being told `h-full`; that child's `h-full` resolved against an
 * *undefined* ancestor height (this slot's own height was itself
 * content-driven), which CSS spec treats as `auto` — so the whole stack
 * collapsed to the image's raw intrinsic pixel size (a small srcset
 * candidate, ~67×146px) inside a bezel that still stretched to the full
 * imposed height. That produced a tall empty capsule with a tiny picture
 * pinned at the top — confirmed by measuring the actual rendered image
 * box, which matched its `naturalWidth`/`naturalHeight` almost exactly.
 * `flex-1 min-h-0` on the screen slot means the browser doesn't need any
 * percentage-height math to fill this frame — it makes the slot claim
 * "the remaining space after the speaker row," using the frame's own
 * concrete height in the desktop case, and its content's natural size in
 * the mobile case (where no height is imposed at all) — one rule serving
 * both, verified in both contexts after the fix.
 */
export function PhoneFrame({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`flex flex-col rounded-[2.25rem] border border-line bg-card p-[9px] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div aria-hidden="true" className="mb-[7px] flex shrink-0 justify-center">
        <span className="h-[3px] w-9 rounded-full bg-line" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[1.6rem] bg-black">{children}</div>
    </div>
  );
}
