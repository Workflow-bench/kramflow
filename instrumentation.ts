import { reportError, logSink } from "@/lib/observability/report";

// Server-side exception path (KF-010). Next calls this for every request error.
// The route is the route pattern (for example /api/live), never the raw path, so
// event and token ids in the URL do not reach the report.
export async function onRequestError(
  err: unknown,
  _request: { path: string; method: string; headers: Record<string, string | string[]> },
  context: { routePath?: string; routeType?: string }
) {
  reportError(err, { route: context.routePath ?? "unknown", action: context.routeType }, logSink);
}
