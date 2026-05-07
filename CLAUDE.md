# LungNote — webapp / LLM + Dev Entry Point

> **กฎเหล็ก:** ก่อน build / create / edit / deploy ไฟล์ใดๆ ใน `webapp/` ต้องอ่าน `wikis/` ก่อน.
> สำหรับ LLM agents: อย่าเริ่มเขียนโค้ดจนกว่าจะอ่าน sections ข้างล่างจบ.

@AGENTS.md

## Repo Layout

repo นี้ = `PASAKON/LungNote-webapp` (Next.js app).
ส่วนหนึ่งของ 3-repo split — ดู [ADR-0002](https://github.com/PASAKON/LungNote-wikis/blob/main/40-Decisions/0002-split-repos-webapp-wikis-design.md):

```
~/code/lungnote/                          # parent (no git)
├── webapp/    ← repo นี้                 → PASAKON/LungNote-webapp
├── wikis/     ← Obsidian vault docs      → PASAKON/LungNote-wikis
└── design/    ← HTML mockups             → PASAKON/LungNote-design
```

**Setup workspace ทั้ง 3 repo:**

```bash
git clone https://github.com/PASAKON/LungNote-webapp.git webapp
cd webapp && ./scripts/setup-workspace.sh ~/code/lungnote
```

## Required Reading (ทุก dev/LLM session)

อ่านที่ [PASAKON/LungNote-wikis](https://github.com/PASAKON/LungNote-wikis) (หรือ `../wikis/` ถ้า clone มาแล้ว):

1. [00-Index/README.md](https://github.com/PASAKON/LungNote-wikis/blob/main/00-Index/README.md) — map ทั้ง vault
2. [10-Architecture/Overview.md](https://github.com/PASAKON/LungNote-wikis/blob/main/10-Architecture/Overview.md) — system shape, data flow
3. [20-Conventions/Code-Style.md](https://github.com/PASAKON/LungNote-wikis/blob/main/20-Conventions/Code-Style.md) — naming, lint
4. [20-Conventions/Commit-Convention.md](https://github.com/PASAKON/LungNote-wikis/blob/main/20-Conventions/Commit-Convention.md)
5. [20-Conventions/Wiki-Style.md](https://github.com/PASAKON/LungNote-wikis/blob/main/20-Conventions/Wiki-Style.md) — กฎเขียน wiki
6. [40-Decisions/README.md](https://github.com/PASAKON/LungNote-wikis/blob/main/40-Decisions/README.md) — ADR index
7. [50-Workflows/Dev-Workflow.md](https://github.com/PASAKON/LungNote-wikis/blob/main/50-Workflows/Dev-Workflow.md) — code workflow
8. [50-Workflows/Multi-Repo-Workflow.md](https://github.com/PASAKON/LungNote-wikis/blob/main/50-Workflows/Multi-Repo-Workflow.md) — 3-repo setup, .env sharing, conflict prevention

## Hard Rules

1. **Wiki ก่อนโค้ด** — แก้ architecture / decision ใหญ่ → เขียน ADR ใน `LungNote-wikis/40-Decisions/` ก่อน หรือพร้อม PR
2. **Conventional Commits** — ดู Commit-Convention
3. **TypeScript strict** — ห้าม `any`
4. **Mobile-first Tailwind** — default = mobile, ใช้ breakpoints ขยายขึ้น
5. **ห้ามเพิ่ม dependency ที่กระทบ architecture** (auth, db, state mgmt) โดยไม่จด ADR
6. **ทุก PR ที่เปลี่ยน behavior ต้อง update wiki ที่เกี่ยว** — ถ้าไม่มี wiki ที่ตรง สร้างใหม่ใน `LungNote-wikis`
7. **Cross-repo PR coordination** — link wiki PR ↔ webapp PR ใน description (ดู Multi-Repo §4.3)
8. **ห้ามใช้ `npm` หรือ `yarn`** — ใช้ `pnpm` เท่านั้น (lockfile compat)
9. **ห้าม commit `.env*`** — secret อยู่ที่ Vercel, sync ลงด้วย `./scripts/pull-env.sh`
10. **ห้าม push --force ที่ main** — ใช้ `--force-with-lease` ที่ feature branch เท่านั้น

## Common Commands

```bash
# Daily start
./scripts/sync-all.sh           # rebase main ของ 3 repo
./scripts/pull-env.sh           # sync env จาก Vercel

# Dev
pnpm dev                        # http://localhost:3000

# Verify
pnpm lint && pnpm build         # build รวม typecheck

# Status check
./scripts/status-all.sh         # git status ของ 3 repo

# Add ADR ใหม่ (ใน wiki repo)
cd ../wikis
cp 90-Templates/ADR-Template.md 40-Decisions/NNNN-<slug>.md
# แก้ frontmatter + อัพเดท index ใน 40-Decisions/README.md

# Add env var ที่ใช้ทุก dev
vercel env add MY_VAR development preview production
# แล้วบอกทีม pull ใหม่: ./scripts/pull-env.sh
```

## Stack (TL;DR)

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4
- **UI**: shadcn/ui + base-ui + lucide
- **i18n**: native Next 16 (`[locale]` segment + `proxy.ts`)
- **PWA**: native `manifest.ts`
- **Deploy**: Vercel + custom domain `lungnote.com` ([ADR-0005](https://github.com/PASAKON/LungNote-wikis/blob/main/40-Decisions/0005-deploy-vercel.md))
- **DB + Auth**: Supabase ([ADR-0006](https://github.com/PASAKON/LungNote-wikis/blob/main/40-Decisions/0006-supabase-db-auth.md))

## For LLM Agents

- เริ่มทุก session ด้วยการอ่าน [LungNote-wikis 00-Index/README](https://github.com/PASAKON/LungNote-wikis/blob/main/00-Index/README.md)
- ถ้า user ถามเรื่อง decision → อ่าน [40-Decisions/](https://github.com/PASAKON/LungNote-wikis/tree/main/40-Decisions) ก่อนตอบ
- ถ้า user สั่งเปลี่ยน architecture → propose ADR ใหม่, อย่าเพิ่งแก้โค้ด
- ใช้ wikilinks `[[ ]]` ใน markdown ของ vault, ไม่ใช่ relative path (Obsidian-first)
- ทุก PR ที่เกี่ยวข้องโค้ด — ตรวจว่ามี wiki ที่ stale ต้อง update ไหม
- LLM agent อาจไม่มี sibling `../wikis/` ใน working dir — ถ้าไม่เห็น ให้ refer GitHub URL
