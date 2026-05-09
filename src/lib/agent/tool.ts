import "server-only";
import type { z } from "zod";
import type { TurnContext } from "./context";

/**
 * AgentTool — self-contained tool definition. Each tool lives in
 * `lib/agent/tools/<category>/<name>.ts` and gets registered via
 * `lib/agent/registry.ts`. Adding a new tool = create file + add to
 * the TOOLS array.
 *
 * Type parameters:
 *   - TArgs: zod-inferred shape of the tool's arguments
 *   - TResult: shape of the structured result the tool returns to the AI
 */
export type AgentRequirement = "linked" | "pending_listed" | "done_listed";

export type AgentToolResult =
  | { ok: true; [k: string]: unknown }
  | { ok: false; reason: string; [k: string]: unknown };

export type AgentTool<TArgs = unknown> = {
  /** Tool name as the model sees it. snake_case. */
  name: string;
  /** Coarse category — used for grouping in the admin viewer / tests. */
  category: "memory" | "auth" | "system";
  /** Description sent to the model. Keep short — system prompt has the
   *  decision tree; this is the per-tool reminder. */
  description: string;
  /** Zod schema for the args. Vercel AI SDK uses this directly. */
  schema: z.ZodSchema<TArgs>;
  /** Pre-conditions checked before execute. Failing here returns a
   *  structured error the model can read in the next loop iter. */
  requires?: AgentRequirement[];
  /** Tool implementation. Pure logic — preconditions handled by registry. */
  execute: (args: TArgs, ctx: TurnContext) => Promise<AgentToolResult>;
};
