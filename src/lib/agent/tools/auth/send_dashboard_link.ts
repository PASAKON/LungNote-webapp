import "server-only";
import { z } from "zod";
import { mintToken } from "@/lib/auth/line-link";
import type { AgentTool } from "../../tool";

const SITE_URL = "https://lungnote.com";
const args = z.object({}).strict();

export const sendDashboardLinkTool: AgentTool<z.infer<typeof args>> = {
  name: "send_dashboard_link",
  category: "auth",
  description:
    "Mint one-time web login URL (5min TTL). Call for 'dashboard'/'เว็บ'/'login' or to link unlinked users. Include URL verbatim in reply.",
  schema: args,
  requires: ["linked"],
  async execute(_input, ctx) {
    if (!ctx.lineUserId) return { ok: false, reason: "not_linked" };
    try {
      const { token } = await mintToken(ctx.lineUserId);
      return {
        ok: true,
        url: `${SITE_URL}/auth/line?t=${token}`,
        expires_in_minutes: 5,
        instructions:
          "Reply naturally and include this URL on its own line so LINE renders the link preview.",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      return { ok: false, reason: "mint_failed", error: msg };
    }
  },
};
