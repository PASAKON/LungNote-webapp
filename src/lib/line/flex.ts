import type { FlexMessage, LineMessage } from "./client";
import welcomeTemplate from "./flex-templates/welcome.json";
import dashboardLinkTemplate from "./flex-templates/dashboard-link.json";
import noteSavedTemplate from "./flex-templates/note-saved.json";
import errorTemplate from "./flex-templates/error.json";

// Designer-supplied Flex JSON lives in ./flex-templates/.
// Templates ship with placeholder URIs ("https://liff.line.me/YOUR_LIFF_ID/...")
// and {{token}}-style text placeholders; we substitute at runtime.

const SITE_URL = "https://lungnote.com";

export function dashboardLinkMessage(authUrl: string): LineMessage[] {
  const tpl = clone(dashboardLinkTemplate) as FlexMessage;
  rewriteUriActions(tpl.contents, (uri) =>
    uri.includes("/dashboard") || uri.includes("YOUR_LIFF_ID")
      ? authUrl
      : uri,
  );
  return [tpl];
}

export function welcomeMessage(): LineMessage[] {
  const tpl = clone(welcomeTemplate) as FlexMessage;
  rewriteUriActions(tpl.contents, (uri) =>
    uri.includes("YOUR_LIFF_ID") ? `${SITE_URL}` : uri,
  );
  return [tpl];
}

export function noteSavedMessage(opts: {
  title: string;
  folderName?: string | null;
  noteId: string;
  authUrl: string;
}): LineMessage[] {
  const tpl = clone(noteSavedTemplate) as FlexMessage;
  const savedAt = new Date().toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  substituteText(tpl.contents, {
    "{{note_title}}": opts.title,
    "{{folder_name}}": opts.folderName ?? "ไม่มีโฟลเดอร์",
    "{{saved_at}}": savedAt,
    "{{note_id}}": opts.noteId,
  });
  rewriteUriActions(tpl.contents, (uri) =>
    uri.includes("YOUR_LIFF_ID") ? opts.authUrl : uri,
  );
  return [tpl];
}

export function errorFlexMessage(message: string): LineMessage[] {
  const tpl = clone(errorTemplate) as FlexMessage;
  substituteText(tpl.contents, { "{{MESSAGE}}": message });
  return [tpl];
}

// ---------- helpers ----------

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function substituteText(
  node: unknown,
  replacements: Record<string, string>,
): void {
  if (Array.isArray(node)) {
    for (const item of node) substituteText(item, replacements);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (k === "text" && typeof v === "string") {
        let next = v;
        for (const [needle, replacement] of Object.entries(replacements)) {
          next = next.split(needle).join(replacement);
        }
        obj[k] = next;
      } else {
        substituteText(v, replacements);
      }
    }
  }
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
