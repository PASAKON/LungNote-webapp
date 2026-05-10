import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * `cookieEncoding: "raw"` works around a known bug in @supabase/ssr's
 * default base64url encoder that throws "Invalid UTF-8 sequence" once
 * a session cookie holds certain byte patterns. Confirmed by
 * https://github.com/supabase/ssr/issues/67. Server + browser must
 * agree on the encoding — set the same flag in middleware.ts and
 * server.ts.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieEncoding: "raw" },
  );
}
