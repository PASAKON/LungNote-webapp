import type { FlexMessage, LineMessage } from "./client";
import welcomeTemplate from "./flex-templates/welcome.json";
import dashboardLinkTemplate from "./flex-templates/dashboard-link.json";

// Designer-supplied Flex JSON lives in ./flex-templates/.
// Each template ships with the placeholder `YOUR_LIFF_ID` baked into
// LIFF launcher URIs (https://liff.line.me/YOUR_LIFF_ID?next=...).
// At runtime we swap that token for the real LIFF id from env so the
// button opens the LIFF launcher → auto-login → next path.
// AI-driven templates (todo_*, error_inline, multi_save_summary) go
// through the separate builder in @/lib/agent/flex/templates.ts.

const SITE_URL = "https://lungnote.com";

function getLiffId(): string {
  return (process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "").trim();
}

/**
 * Resolve YOUR_LIFF_ID inside a URI.
 *
 * - LIFF id configured → swap YOUR_LIFF_ID → real id. The LIFF launcher
 *   handles auth automatically via id_token.
 * - No LIFF id (dev / preview) → fall back to the one-time auth-link
 *   URL if provided, else a plain SITE_URL+path deep link.
 */
function resolveLiffUri(uri: string, authUrl?: string): string {
  if (!uri.includes("YOUR_LIFF_ID")) return uri;
  const id = getLiffId();
  if (id) return uri.replace("YOUR_LIFF_ID", id);
  if (authUrl) return authUrl;
  try {
    const u = new URL(uri.replace("YOUR_LIFF_ID", "_"));
    const next = u.searchParams.get("next");
    const path = next ? decodeURIComponent(next) : "/th/dashboard";
    return `${SITE_URL}${path}`;
  } catch {
    return `${SITE_URL}/th/dashboard`;
  }
}

export function dashboardLinkMessage(authUrl: string): LineMessage[] {
  const tpl = clone(dashboardLinkTemplate) as FlexMessage;
  rewriteUriActions(tpl.contents, (uri) => resolveLiffUri(uri, authUrl));
  return [tpl];
}

export function welcomeMessage(): LineMessage[] {
  const tpl = clone(welcomeTemplate) as FlexMessage;
  rewriteUriActions(tpl.contents, (uri) => resolveLiffUri(uri));
  return [tpl];
}

// ---------- helpers ----------

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function rewriteUriActions(
  node: unknown,
  rewrite: (uri: string) => string,
): void {
  if (Array.isArray(node)) {
    for (const item of node) rewriteUriActions(item, rewrite);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const action = obj.action as Record<string, unknown> | undefined;
    if (action && action.type === "uri" && typeof action.uri === "string") {
      action.uri = rewrite(action.uri);
    }
    if (typeof obj.uri === "string" && obj.type === "uri") {
      obj.uri = rewrite(obj.uri);
    }
    for (const v of Object.values(obj)) rewriteUriActions(v, rewrite);
  }
}
