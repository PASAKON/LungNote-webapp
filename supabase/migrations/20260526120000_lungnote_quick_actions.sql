-- ADR-0022: Quick-action chips for email-sourced todos.
-- Adds:
--   1. lungnote_gmail_synced_messages.suggested_actions — AI-proposed one-tap
--      replies captured at classify time (jsonb array of {label,body,intent,need_reason}).
--   2. lungnote_quick_actions — user-defined reusable reply buttons.
--   3. RLS deny-by-default + per-owner policies + moddatetime trigger.

create extension if not exists "moddatetime";
create extension if not exists "pgcrypto";

-- =============================================================
-- 1. Persist classifier-suggested actions on the synced message.
--    Default '[]' so existing rows + inserts that skip it stay valid.
-- =============================================================
alter table lungnote_gmail_synced_messages
  add column if not exists suggested_actions jsonb not null default '[]'::jsonb;

-- =============================================================
-- 2. lungnote_quick_actions — reusable, user-authored reply buttons.
--    scope='global'   → offered on every email todo.
--    scope='category' → offered when an email todo's category matches
--                       match_category (e.g. 'approval').
-- =============================================================
create table if not exists lungnote_quick_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null check (length(label) between 1 and 40),
  body text not null check (length(body) between 1 and 2000),
  intent text not null default 'other'
    check (intent in ('approve', 'reject', 'ask', 'ack', 'other')),
  scope text not null default 'global'
    check (scope in ('global', 'category')),
  match_category text,
  need_reason boolean not null default false,
  emoji text,
  position integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_quick_actions_user_id_idx
  on lungnote_quick_actions(user_id);
create index if not exists lungnote_quick_actions_user_enabled_idx
  on lungnote_quick_actions(user_id, enabled)
  where enabled = true;

create trigger lungnote_quick_actions_updated_at
  before update on lungnote_quick_actions
  for each row execute function moddatetime(updated_at);

alter table lungnote_quick_actions enable row level security;

create policy lungnote_quick_actions_select_own
  on lungnote_quick_actions for select using (auth.uid() = user_id);
create policy lungnote_quick_actions_insert_own
  on lungnote_quick_actions for insert with check (auth.uid() = user_id);
create policy lungnote_quick_actions_update_own
  on lungnote_quick_actions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_quick_actions_delete_own
  on lungnote_quick_actions for delete using (auth.uid() = user_id);
