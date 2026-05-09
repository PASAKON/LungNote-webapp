import "server-only";
import { tool, type Tool, type ToolSet } from "ai";
import type { AgentTool, AgentRequirement, AgentToolResult } from "./tool";
import type { TurnContext } from "./context";

/**
 * Build a Vercel AI SDK ToolSet from our AgentTool registry, bound to a
 * specific TurnContext. Each tool wrapper enforces preconditions in code
 * (not prompt) and feeds traces.
 *
 * Why a wrapper: AgentTool is provider-agnostic and testable in isolation.
 * The AI SDK shape is the "wire format" only used at runtime.
 */
export function buildToolSet(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: AgentTool<any>[],
  ctx: TurnContext,
): ToolSet {
  const out: ToolSet = {};
  for (const t of tools) {
    out[t.name] = wrap(t, ctx);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrap(t: AgentTool<any>, ctx: TurnContext): Tool {
  return tool({
    description: t.description,
    inputSchema: t.schema,
    execute: async (input: unknown) => {
      const precheck = checkRequirements(t.requires, ctx);
      if (precheck) {
        ctx.trace.recordTool(t.name, input, precheck);
        return precheck;
      }
      let result: AgentToolResult;
      try {
        result = await t.execute(input, ctx);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result = { ok: false, reason: "execution_error", error: msg };
      }
      ctx.trace.recordTool(t.name, input, result);
      return result;
    },
  });
}

function checkRequirements(
  reqs: AgentRequirement[] | undefined,
  ctx: TurnContext,
): AgentToolResult | null {
  if (!reqs) return null;
  for (const r of reqs) {
    if (r === "linked" && !ctx.lineUserId) {
      return {
        ok: false,
        reason: "not_linked",
        message:
          "User has not linked their LINE account. Call send_dashboard_link first so they can log in.",
      };
    }
    if (r === "pending_listed" && !ctx.hasPendingList()) {
      return {
        ok: false,
        reason: "must_list_pending_first",
        message:
          "Call list_pending in this turn before any *_by_position tool. The server caches the list and resolves position to id — never reuse positions across turns.",
      };
    }
    if (r === "done_listed" && !ctx.hasDoneList()) {
      return {
        ok: false,
        reason: "must_list_done_first",
        message: "Call list_done in this turn before uncomplete_by_position.",
      };
    }
  }
  return null;
}
