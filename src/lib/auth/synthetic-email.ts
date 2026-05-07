const SYNTHETIC_DOMAIN = "auth.lungnote.com";

export function syntheticEmailFromLineUserId(lineUserId: string): string {
  const safe = lineUserId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!safe) throw new Error("invalid line_user_id");
  return `line.${safe}@${SYNTHETIC_DOMAIN}`;
}
