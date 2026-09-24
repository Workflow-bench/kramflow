import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// The one place this app talks to Claude. Every AI feature (cue-sheet
// import, readiness review, alert drafting, post-show report) goes through
// runStructured so model choice, error mapping and output validation live
// in a single file rather than being repeated per route.
//
// Optional by design: with no ANTHROPIC_API_KEY the rest of the app runs
// exactly as before and each AI route answers 503 (see ai-guard.ts).

// Two tiers so cost tracks how much accuracy a feature needs:
//   fast    - short, low-stakes drafting (alerts); the cheapest model.
//   quality - reading whole documents and judging a cue sheet (import,
//             readiness review, post-show summary). Haiku made factual
//             slips on these in testing, so they get a stronger model.
// Override either with ANTHROPIC_MODEL_FAST / ANTHROPIC_MODEL_QUALITY.
const DEFAULT_MODELS = {
  fast: "claude-haiku-4-5",
  quality: "claude-sonnet-5",
} as const;

export type AiTier = keyof typeof DEFAULT_MODELS;

function modelFor(tier: AiTier): string {
  const override = tier === "fast" ? process.env.ANTHROPIC_MODEL_FAST : process.env.ANTHROPIC_MODEL_QUALITY;
  return override || DEFAULT_MODELS[tier];
}

export type AiEffort = "low" | "medium" | "high";

export class AiError extends Error {
  constructor(
    message: string,
    /** HTTP status the calling route should answer with. */
    readonly status: number
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// Haiku 4.5 predates adaptive thinking and the effort setting: sending
// either is a 400. Every other current model accepts both.
function supportsThinkingControls(model: string): boolean {
  return !/haiku/i.test(model);
}

let cachedClient: Anthropic | null = null;
function client(): Anthropic {
  cachedClient ??= new Anthropic();
  return cachedClient;
}

function mapApiError(err: unknown): AiError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("AI request rejected — check ANTHROPIC_API_KEY:", err.message);
    return new AiError("AI is not available right now.", 503);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("The AI service is busy. Try again in a moment.", 429);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("Couldn't reach the AI service. Try again.", 502);
  }
  console.error("AI request failed:", err);
  return new AiError("The AI request failed. Try again.", 502);
}

export interface StructuredRequest<S extends z.ZodType> {
  /** Task instructions. Keep untrusted content out of here — put it in `prompt`. */
  system: string;
  /** The user turn, including any untrusted document text (wrap it in tags). */
  prompt: string;
  schema: S;
  maxTokens: number;
  /** Which model tier to use. Defaults to "quality". */
  tier?: AiTier;
  effort?: AiEffort;
}

// One structured call: the schema is sent as the response format so the
// model is constrained to it, then re-validated here with the same zod
// schema — the second check is what the callers rely on, because the
// constrained format can't express every rule (ranges, lengths, ...).
// A reply that fails validation is retried once before giving up.
export async function runStructured<S extends z.ZodType>(req: StructuredRequest<S>): Promise<z.infer<S>> {
  let lastProblem = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = modelFor(req.tier ?? "quality");
    let message: Anthropic.Message;
    try {
      // Streamed even though only the final message is used: large
      // max_tokens on a non-streaming request trips the SDK's timeout guard.
      message = await client()
        .messages.stream({
          model,
          max_tokens: req.maxTokens,
          ...(supportsThinkingControls(model) ? { thinking: { type: "adaptive" as const } } : {}),
          output_config: {
            ...(supportsThinkingControls(model) ? { effort: req.effort ?? "medium" } : {}),
            format: zodOutputFormat(req.schema),
          },
          system: req.system,
          messages: [{ role: "user", content: req.prompt }],
        })
        .finalMessage();
    } catch (err) {
      throw mapApiError(err);
    }

    if (message.stop_reason === "refusal") {
      throw new AiError("The AI declined to process this content.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      throw new AiError("The result was too large to generate in one go. Try a smaller input.", 413);
    }

    const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    try {
      const parsed = req.schema.safeParse(JSON.parse(text));
      if (parsed.success) return parsed.data;
      lastProblem = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch {
      lastProblem = "reply was not valid JSON";
    }
  }
  console.error("AI reply failed validation twice:", lastProblem);
  throw new AiError("The AI returned an unusable result. Try again.", 502);
}
