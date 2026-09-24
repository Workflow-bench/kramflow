import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const stream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    static AuthenticationError = class extends APIError {};
    static PermissionDeniedError = class extends APIError {};
    static RateLimitError = class extends APIError {};
    static APIConnectionError = class extends APIError {};
    messages = { stream };
  }
  return { default: Anthropic };
});
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: () => ({ type: "json_schema" }) }));

const { runStructured, AiError, isAiConfigured } = await import("./ai");
const Anthropic = (await import("@anthropic-ai/sdk")).default as unknown as {
  AuthenticationError: new () => Error;
  RateLimitError: new () => Error;
  APIConnectionError: new () => Error;
};

const schema = z.object({ answer: z.string() });
const request = { system: "s", prompt: "p", schema, maxTokens: 100 };

function reply(text: string, stop_reason = "end_turn") {
  return { finalMessage: async () => ({ stop_reason, content: [{ type: "thinking" }, { type: "text", text }] }) };
}

beforeEach(() => {
  stream.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runStructured", () => {
  it("returns the validated reply", async () => {
    stream.mockReturnValueOnce(reply('{"answer":"ok"}'));
    await expect(runStructured(request)).resolves.toEqual({ answer: "ok" });
  });

  it("uses adaptive thinking, the requested effort and the configured model", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-test");
    stream.mockReturnValueOnce(reply('{"answer":"ok"}'));
    await runStructured({ ...request, effort: "low" });
    const params = stream.mock.calls[0][0];
    expect(params.model).toBe("claude-test");
    expect(params.thinking).toEqual({ type: "adaptive" });
    expect(params.output_config.effort).toBe("low");
    vi.unstubAllEnvs();
  });

  it("defaults to claude-opus-5", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "");
    stream.mockReturnValueOnce(reply('{"answer":"ok"}'));
    await runStructured(request);
    expect(stream.mock.calls[0][0].model).toBe("claude-opus-5");
    vi.unstubAllEnvs();
  });

  it("retries once when the reply fails validation", async () => {
    stream.mockReturnValueOnce(reply('{"wrong":1}')).mockReturnValueOnce(reply('{"answer":"second"}'));
    await expect(runStructured(request)).resolves.toEqual({ answer: "second" });
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("retries once on invalid JSON, then gives up with a 502", async () => {
    stream.mockReturnValue(reply("not json"));
    await expect(runStructured(request)).rejects.toMatchObject({ status: 502 });
    expect(stream).toHaveBeenCalledTimes(2);
  });

  it("maps a refusal to 422 without retrying", async () => {
    stream.mockReturnValueOnce(reply("", "refusal"));
    await expect(runStructured(request)).rejects.toMatchObject({ status: 422 });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it("maps a truncated reply to 413 without retrying", async () => {
    stream.mockReturnValueOnce(reply('{"answer":"cut', "max_tokens"));
    await expect(runStructured(request)).rejects.toMatchObject({ status: 413 });
    expect(stream).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["authentication", () => new Anthropic.AuthenticationError(), 503],
    ["rate limit", () => new Anthropic.RateLimitError(), 429],
    ["connection", () => new Anthropic.APIConnectionError(), 502],
    ["anything else", () => new Error("boom"), 502],
  ])("maps a %s error to its status", async (_name, make, status) => {
    stream.mockReturnValueOnce({ finalMessage: async () => Promise.reject(make()) });
    const err = await runStructured(request).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.status).toBe(status);
  });

  it("never leaks the underlying error text to the caller", async () => {
    stream.mockReturnValueOnce({ finalMessage: async () => Promise.reject(new Error("sk-ant-secret in message")) });
    const err = await runStructured(request).catch((e) => e);
    expect(err.message).not.toContain("sk-ant");
  });
});

describe("isAiConfigured", () => {
  it("follows ANTHROPIC_API_KEY", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isAiConfigured()).toBe(false);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-x");
    expect(isAiConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});
