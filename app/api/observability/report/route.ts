import { NextResponse } from "next/server";
import { logSink, redact } from "@/lib/observability/report";

// Receives a client-side exception report (KF-010). It writes to the server log
// only; nothing is transmitted. The body is capped and every field is redacted
// again here, so a client cannot send more than the sink will record. Abuse
// limits are per instance and best-effort; the cap bounds each record.
const MAX_BODY = 8 * 1024;
const MAX_FIELD = 2000;

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? redact(value).slice(0, max) : undefined;
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY) return new NextResponse(null, { status: 413 });
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (raw.length > MAX_BODY) return new NextResponse(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const report = {
    name: text(body.name, 80) ?? "Error",
    message: text(body.message, MAX_FIELD) ?? "",
    stack: text(body.stack, MAX_FIELD),
    route: text(body.route, 120),
    action: text(body.action, 120),
    release: process.env.KRAMFLOW_RELEASE ?? "unknown",
    environment: process.env.NODE_ENV ?? "unknown",
    source: "client",
    at: new Date().toISOString(),
  };
  logSink(report);
  return new NextResponse(null, { status: 204 });
}
