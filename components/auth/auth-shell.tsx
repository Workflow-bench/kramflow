import Link from "next/link";
import { Wordmark } from "@/components/site/wordmark";
import { AuthArt } from "./auth-art";

// One composition for login, signup, recovery and confirmation states (design D01, D03, D05).
// Desktop (from 960px): preview art about 55%, form about 45%, form column 400-440px, inside a
// 1200px frame. Below 960px: one column, form first, art omitted. The page scrolls naturally;
// nothing is fixed-height or vertically centred off the scroll origin, so a short viewport or
// long content keeps the wordmark and form reachable.
export function AuthShell({
  title,
  support,
  children,
  footer,
  showArt = true,
}: {
  title: string;
  support?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showArt?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background text-primary">
      <div className="mx-auto grid min-h-dvh w-full max-w-[1200px] grid-cols-1 min-[960px]:grid-cols-[55fr_45fr]">
        {showArt && <AuthArt className="hidden min-[960px]:flex min-[960px]:flex-col min-[960px]:justify-center" />}
        <main className="flex flex-col px-6 py-10 sm:px-10 min-[960px]:justify-center min-[960px]:px-12 min-[960px]:py-16">
          <div className="w-full max-w-[420px] min-[960px]:max-w-[440px]">
            <Link
              href="/"
              className="-my-3 inline-block rounded-chip py-3 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Wordmark />
            </Link>
            <h1 className="mt-10 font-display text-[28px] leading-[34px] text-primary sm:text-[32px] sm:leading-[40px] min-[960px]:text-[36px] min-[960px]:leading-[44px]">
              {title}
            </h1>
            {support && <p className="mt-3 text-[16px] leading-6 text-muted">{support}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-[14px] leading-5 text-muted-2">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
