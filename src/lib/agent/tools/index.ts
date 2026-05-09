import "server-only";
import type { AgentTool } from "../tool";

import { saveMemoryTool } from "./memory/save_memory";
import { listPendingTool } from "./memory/list_pending";
import { listDoneTool } from "./memory/list_done";
import { completeByPositionTool } from "./memory/complete_by_position";
import { deleteByPositionTool } from "./memory/delete_by_position";
import { updateByPositionTool } from "./memory/update_by_position";
import { uncompleteByPositionTool } from "./memory/uncomplete_by_position";
import { sendDashboardLinkTool } from "./auth/send_dashboard_link";
import { updateMemoryTool } from "./profile/update_memory";

/**
 * All tools available to the agent. Add a new tool by:
 *   1. Create lib/agent/tools/<category>/<name>.ts exporting `AgentTool`.
 *   2. Import it here and add to ALL_TOOLS.
 *   3. (Optional) Mention it in the system prompt's decision tree.
 */
// TArgs varies per tool (zod-typed). The registry receives the args as
// `unknown` and validates at runtime via the schema, so we widen the array
// element type here. eslint-disable for the explicit any — it's the
// idiomatic shape for a heterogeneous tool registry.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_TOOLS: AgentTool<any>[] = [
  // Memory — preferred position-aware mutations first
  listPendingTool,
  listDoneTool,
  saveMemoryTool,
  completeByPositionTool,
  uncompleteByPositionTool,
  updateByPositionTool,
  deleteByPositionTool,
  // Auth
  sendDashboardLinkTool,
  // Profile (persistent user facts)
  updateMemoryTool,
];

export {
  saveMemoryTool,
  listPendingTool,
  listDoneTool,
  completeByPositionTool,
  deleteByPositionTool,
  updateByPositionTool,
  uncompleteByPositionTool,
  sendDashboardLinkTool,
  updateMemoryTool,
};
