/**
 * Admin one-shot script — upload both LungNote rich menus to LINE,
 * set Default as the global default, and print the IDs to copy into
 * Vercel env (LINE_RICHMENU_DEFAULT_ID, LINE_RICHMENU_WELCOME_ID).
 *
 * Run locally with the LINE_CHANNEL_ACCESS_TOKEN and
 * NEXT_PUBLIC_LINE_LIFF_ID env vars set:
 *
 *   pnpm tsx scripts/setup-rich-menus.ts
 *
 * Re-run after Designer ships new images: pass --replace to delete
 * any existing menus with the same name first.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createRichMenu,
  uploadRichMenuImage,
  setDefaultRichMenu,
  listRichMenus,
  deleteRichMenu,
  substituteLiffId,
  type RichMenuConfig,
} from "../src/lib/line/rich-menu";

const PUBLIC_DIR = path.join(process.cwd(), "public", "rich-menu");

async function loadAsset(slug: "default" | "welcome"): Promise<{
  config: RichMenuConfig;
  imageBytes: Buffer;
}> {
  const json = await readFile(path.join(PUBLIC_DIR, `${slug}.json`), "utf8");
  const config = JSON.parse(json) as RichMenuConfig;
  const imageBytes = await readFile(path.join(PUBLIC_DIR, `${slug}.png`));
  return { config: substituteLiffId(config), imageBytes };
}

async function deleteByName(name: string): Promise<void> {
  const list = await listRichMenus();
  if (!list.ok) {
    console.warn(`listRichMenus failed: ${list.error}`);
    return;
  }
  for (const m of list.data.richmenus) {
    if (m.name === name) {
      console.log(`  deleting existing "${name}" (id=${m.richMenuId})`);
      const del = await deleteRichMenu(m.richMenuId);
      if (!del.ok) console.warn(`  delete failed: ${del.error}`);
    }
  }
}

async function uploadOne(slug: "default" | "welcome"): Promise<string> {
  console.log(`\n📤 Uploading ${slug} …`);
  const { config, imageBytes } = await loadAsset(slug);

  if (process.argv.includes("--replace")) {
    await deleteByName(config.name);
  }

  const create = await createRichMenu(config);
  if (!create.ok) {
    throw new Error(`createRichMenu(${slug}) failed: ${create.error}`);
  }
  const richMenuId = create.data.richMenuId;
  console.log(`  ✓ created richMenuId=${richMenuId}`);

  const upload = await uploadRichMenuImage(richMenuId, imageBytes);
  if (!upload.ok) {
    throw new Error(`uploadRichMenuImage(${slug}) failed: ${upload.error}`);
  }
  console.log(`  ✓ uploaded image (${imageBytes.byteLength} bytes)`);
  return richMenuId;
}

async function main(): Promise<void> {
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN missing — set in .env.local");
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_LINE_LIFF_ID) {
    console.warn(
      "NEXT_PUBLIC_LINE_LIFF_ID missing — Default rich menu URIs will keep the {{LIFF_ID}} placeholder",
    );
  }

  const defaultId = await uploadOne("default");
  const welcomeId = await uploadOne("welcome");

  console.log("\n🌐 Setting Default as global default …");
  const setDefault = await setDefaultRichMenu(defaultId);
  if (!setDefault.ok) {
    throw new Error(`setDefaultRichMenu failed: ${setDefault.error}`);
  }
  console.log("  ✓ global default set");

  console.log("\n✅ Done. Add to Vercel env:");
  console.log(`  LINE_RICHMENU_DEFAULT_ID=${defaultId}`);
  console.log(`  LINE_RICHMENU_WELCOME_ID=${welcomeId}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
