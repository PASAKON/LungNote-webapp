import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { chatCompletion, AIClientError } from "@/lib/ai/client";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  process.env.OPENROUTER_API_KEY = "test-key";
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("chatCompletion", () => {
  it("returns reply text + token usage on success", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async ({ request }) => {
        const body = (await request.json()) as { model: string; messages: unknown[]; max_tokens: number };
        expect(body.model).toBe("google/gemini-2.5-flash");
        expect(body.max_tokens).toBe(300);
        return HttpResponse.json({
          choices: [{ message: { content: "สวัสดีครับ" } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });
      }),
    );

    const result = await chatCompletion([{ role: "user", content: "hi" }]);
    expect(result.text).toBe("สวัสดีครับ");
    expect(result.tokensIn).toBe(100);
    expect(result.tokensOut).toBe(20);
    expect(result.costEstimate).toBeGreaterThan(0);
  });

  it("throws AIClientError on HTTP 5xx", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", () =>
        new HttpResponse("upstream broken", { status: 503 }),
      ),
    );
    await expect(
      chatCompletion([{ role: "user", content: "hi" }]),
    ).rejects.toBeInstanceOf(AIClientError);
  });

  it("throws on empty content", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", () =>
        HttpResponse.json({ choices: [{ message: { content: "  " } }] }),
      ),
    );
    await expect(
      chatCompletion([{ role: "user", content: "hi" }]),
    ).rejects.toThrow(/empty content/);
  });

  it("respects custom timeout", async () => {
    server.use(
      http.post("https://openrouter.ai/api/v1/chat/completions", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ choices: [{ message: { content: "late" } }] });
      }),
    );
    await expect(
      chatCompletion([{ role: "user", content: "hi" }], { timeoutMs: 50 }),
    ).rejects.toThrow(/timed out/);
  });
});
