import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// B006-F2: route metadata policy. Every private surface must set noindex in its
// own layout, and no page under app/ may fall outside the inventory below. The
// checks read the source files, so they cannot pass on a stale import.

const APP = __dirname;

// Private or app-only surfaces: each must carry robots noindex in a layout.
const PRIVATE_SURFACES = ["(operator)", "e/[eventId]", "invite", "(catalog)"];

// Public or intentionally indexable pages: the marketing home only.
const PUBLIC_PAGES = ["page.tsx"];

// Pages that set robots noindex themselves (or through their route layout).
const NOINDEX_PAGE_DIRS = ["av", "custom", "general", "green-room", "login", "presenter", "screens", "set-password", "signup", "tv"];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "api" || name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

function rel(file: string) {
  return path.relative(APP, file).split(path.sep).join("/");
}

describe("route metadata policy (B006-F2)", () => {
  it("every private surface declares robots noindex in a layout", () => {
    for (const surface of PRIVATE_SURFACES) {
      const layout = path.join(APP, surface, "layout.tsx");
      const source = readFileSync(layout, "utf8");
      expect(source, `${surface}/layout.tsx must set robots noindex`).toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });

  it("every page is inventoried: public, noindex-set, or under a private surface", () => {
    const pages = walk(APP).map(rel);
    const unknown = pages.filter((p) => {
      if (PUBLIC_PAGES.includes(p)) return false;
      if (PRIVATE_SURFACES.some((s) => p.startsWith(`${s}/`))) return false;
      if (NOINDEX_PAGE_DIRS.some((d) => p.startsWith(`${d}/`))) return false;
      return true;
    });
    expect(unknown, "add a metadata decision for these pages").toEqual([]);
  });

  it("the homepage keeps its own openGraph site name and type (B006-F1)", () => {
    const source = readFileSync(path.join(APP, "page.tsx"), "utf8");
    expect(source).toMatch(/siteName:\s*"KramFlow"/);
    expect(source).toMatch(/type:\s*"website"/);
  });

  it("no metadata interpolates a route parameter, so previews carry no event or token ids", () => {
    const layouts = walk(APP)
      .map((p) => path.join(path.dirname(p), "layout.tsx"))
      .filter((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
    for (const layout of layouts) {
      const source = readFileSync(layout, "utf8");
      const block = source.match(/export const metadata[\s\S]*?\n\};/)?.[0] ?? "";
      expect(block, `${rel(layout)} metadata must not use params`).not.toMatch(/\$\{|params/);
    }
  });
});
