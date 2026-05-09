import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "node:path";

// Try .env.local first (Next.js convention) then .env. Vitest by default
// doesn't load these; we pull them in here so OPENROUTER_API_KEY etc. are
// available to the agent runtime under test.
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });
