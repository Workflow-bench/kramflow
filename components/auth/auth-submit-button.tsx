"use client";

import { Button } from "@/components/ui/button";

/**
 * The auth forms' primary action, matching the landing page's own primary
 * CTA exactly (components/site/new-landing.tsx's `.hc-btn-primary`): solid
 * `--color-primary` fill, dark text, a flat color crossfade to the
 * product's accent green on hover — same `CINEMATIC` easing curve
 * (0.8s cubic-bezier(0.19, 1, 0.22, 1)) and duration as that button, not
 * Button's own fast 110ms default.
 *
 * An earlier version of this wrapped `liquid-glass-react` around the
 * button for an elastic/refractive hover. Dropped: its inset highlight and
 * gradient sheen read as a glossy jelly button on a solid fill, which is
 * the opposite of the landing page's flat, confident CTA this is supposed
 * to match. The liquid-glass language still lives on this page in the
 * shader backdrop and the translucent form panel — it doesn't need to be
 * on every element.
 */
export function AuthSubmitButton({
  children,
  loading,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <Button
      type="submit"
      variant="primary"
      size="public"
      loading={loading}
      className={`w-full font-semibold transition-[background-color,color] duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] hover:bg-[#30d158] hover:text-background ${className}`}
      {...props}
    >
      {children}
    </Button>
  );
}
