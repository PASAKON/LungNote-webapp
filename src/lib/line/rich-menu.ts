import "server-only";

/**
 * LINE Messaging API — Rich Menu helpers.
 *
 * Endpoints used:
 *   POST   /v2/bot/richmenu                       — create rich menu (returns id)
 *   POST   /v2/bot/richmenu/{id}/content          — upload image bytes
 *   POST   /v2/bot/user/all/richmenu/{id}         — set global default
 *   POST   /v2/bot/user/{userId}/richmenu/{id}    — link 1 user to menu
 *   DELETE /v2/bot/user/{userId}/richmenu         — unlink user (revert to global default)
 *   GET    /v2/bot/richmenu/list                  — list existing
 *   DELETE /v2/bot/richmenu/{id}                  — delete
 *
 * Docs: https://developers.line.biz/en/reference/messaging-api/#rich-menu
 *
 * All helpers fail soft when LINE_CHANNEL_ACCESS_TOKEN is missing — the
 * webhook never blocks on rich-menu work.
 */

const LINE_API = "https://api.line.me/v2/bot";
const LINE_DATA_API = "https://api-data.line.me/v2/bot";

type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

function authHeader(): { Authorization: string } | null {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

export type RichMenuArea = {
  bounds: { x: number; y: number; width: number; height: number };
  action:
    | { type: "uri"; label?: string; uri: string }
    | { type: "message"; label?: string; text: string }
    | { type: "postback"; label?: string; data: string; displayText?: string };
};

export type RichMenuConfig = {
  size: { width: number; height: number };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: RichMenuArea[];
};

export type RichMenuListEntry = {
  richMenuId: string;
  name: string;
  size: { width: number; height: number };
  chatBarText: string;
  selected: boolean;
  areas: RichMenuArea[];
};

/** Create a rich menu (no image yet). Returns the new richMenuId. */
export async function createRichMenu(
  config: RichMenuConfig,
): Promise<ApiResult<{ richMenuId: string }>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/richmenu`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: body };
  }
  try {
    const data = JSON.parse(body) as { richMenuId: string };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, error: `invalid json: ${body}` };
  }
}

/** Upload PNG/JPEG image bytes for an existing richMenuId. */
export async function uploadRichMenuImage(
  richMenuId: string,
  bytes: ArrayBuffer | Uint8Array | Buffer,
  contentType: "image/png" | "image/jpeg" = "image/png",
): Promise<ApiResult<null>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_DATA_API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { ...auth, "Content-Type": contentType },
    body: bytes as BodyInit,
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  return { ok: true, status: res.status, data: null };
}

/** Set a rich menu as the global default for all users (no per-user link). */
export async function setDefaultRichMenu(
  richMenuId: string,
): Promise<ApiResult<null>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: auth,
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  return { ok: true, status: res.status, data: null };
}

/** Link one rich menu to one user — overrides global default for that user. */
export async function linkUserRichMenu(
  userId: string,
  richMenuId: string,
): Promise<ApiResult<null>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/user/${userId}/richmenu/${richMenuId}`, {
    method: "POST",
    headers: auth,
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  return { ok: true, status: res.status, data: null };
}

/**
 * Unlink user-specific menu — user reverts to global default.
 * Idempotent: fine to call when no per-user menu was set (returns 404
 * we treat as ok).
 */
export async function unlinkUserRichMenu(
  userId: string,
): Promise<ApiResult<null>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/user/${userId}/richmenu`, {
    method: "DELETE",
    headers: auth,
  });
  // 404 = no menu was linked for this user → treat as success.
  if (!res.ok && res.status !== 404) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  return { ok: true, status: res.status, data: null };
}

/** List all rich menus on the channel. Used by the setup script. */
export async function listRichMenus(): Promise<
  ApiResult<{ richmenus: RichMenuListEntry[] }>
> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/richmenu/list`, { headers: auth });
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: body };
  }
  try {
    const data = JSON.parse(body) as { richmenus: RichMenuListEntry[] };
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: res.status, error: `invalid json: ${body}` };
  }
}

/** Delete a rich menu by id (fire-and-forget when retiring an old one). */
export async function deleteRichMenu(
  richMenuId: string,
): Promise<ApiResult<null>> {
  const auth = authHeader();
  if (!auth) return { ok: false, status: 0, error: "missing token" };

  const res = await fetch(`${LINE_API}/richmenu/${richMenuId}`, {
    method: "DELETE",
    headers: auth,
  });
  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text() };
  }
  return { ok: true, status: res.status, data: null };
}

/**
 * Substitute the {{LIFF_ID}} placeholder in a rich menu config's URIs.
 * Designer ships JSON with the placeholder so the same file works
 * across dev/preview/prod.
 */
export function substituteLiffId(config: RichMenuConfig): RichMenuConfig {
  const liffId = (process.env.NEXT_PUBLIC_LINE_LIFF_ID ?? "").trim();
  return {
    ...config,
    areas: config.areas.map((a) => ({
      ...a,
      action:
        a.action.type === "uri"
          ? { ...a.action, uri: a.action.uri.replace("{{LIFF_ID}}", liffId) }
          : a.action,
    })),
  };
}
