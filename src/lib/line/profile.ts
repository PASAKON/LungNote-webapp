import "server-only";

const LINE_API = "https://api.line.me/v2/bot";

export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
};

export async function getLineProfile(
  userId: string,
): Promise<LineProfile | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetch(`${LINE_API}/profile/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return (await res.json()) as LineProfile;
}
