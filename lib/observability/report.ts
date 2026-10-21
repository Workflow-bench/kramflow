// Provider-neutral error reporting (KF-010). This module does not send anything
// outbound. It builds a bounded, redacted report and hands it to a sink. The
// default sink writes to the server log; a provider sink can be added later
// without changing callers. Provider, source-map and alert setup stay external.

export interface ReportContext {
  route?: string;
  action?: string;
  release?: string;
  environment?: string;
}

export interface ErrorReport {
  name: string;
  message: string;
  stack?: string;
  route?: string;
  action?: string;
  release: string;
  environment: string;
  at: string;
}

export type ReportSink = (report: ErrorReport) => void;

const MAX_MESSAGE = 500;
const MAX_STACK = 2000;
const MAX_CONTEXT = 120;

// Patterns removed from any text before it leaves the process: credentials, bearer
// tokens, email addresses, UUIDs (event, user and token ids), and long opaque
// strings that look like tokens or cue content.
const REDACTIONS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]"],
  [/bearer\s+[A-Za-z0-9._~+/=-]+/gi, "bearer [token]"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]"],
  [/\b[A-Za-z0-9_-]{32,}\b/g, "[token]"],
  [/(password|passwd|secret|token|apikey|api_key|cookie)\s*[=:]\s*\S+/gi, "$1=[redacted]"],
];

export function redact(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

function bound(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Route and action are identifiers from our own code, not user input. They are
// still scrubbed and bounded, so a dynamic segment such as an event id cannot leak.
function cleanContext(value: string | undefined): string | undefined {
  return value === undefined ? undefined : bound(redact(value), MAX_CONTEXT);
}

export function buildReport(err: unknown, context: ReportContext = {}, now: Date = new Date()): ErrorReport {
  // A non-Error throwable has no trustworthy stack, so none is invented for it.
  const isError = err instanceof Error;
  const name = isError ? err.name || "Error" : "Error";
  const message = isError ? err.message || "" : String(err);
  const stack = isError && err.stack ? err.stack : undefined;
  return {
    name: bound(redact(name), 80),
    message: bound(redact(message), MAX_MESSAGE),
    stack: stack ? bound(redact(stack), MAX_STACK) : undefined,
    route: cleanContext(context.route),
    action: cleanContext(context.action),
    release: cleanContext(context.release ?? process.env.KRAMFLOW_RELEASE ?? "unknown") ?? "unknown",
    environment: cleanContext(context.environment ?? process.env.NODE_ENV ?? "unknown") ?? "unknown",
    at: now.toISOString(),
  };
}

// Default: server log only, with the redacted report. Never transmits.
export const logSink: ReportSink = (report) => {
  console.error("[report]", JSON.stringify(report));
};

export function reportError(err: unknown, context: ReportContext = {}, sink: ReportSink = logSink): void {
  try {
    sink(buildReport(err, context));
  } catch {
    // Reporting must never throw into the request that failed.
  }
}
