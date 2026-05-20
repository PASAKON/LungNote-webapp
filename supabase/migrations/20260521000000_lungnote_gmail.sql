-- ADR-0017 / ADR-0018: Gmail integration v1 (readonly).
-- Adds:
--   1. 'email' to lungnote_todos.source check constraint
--   2. source_external_id + source_url columns on lungnote_todos
--   3. lungnote_gmail_connections table (1 per user, OAuth + watch state)
--   4. lungnote_gmail_synced_messages table (per-message audit + dedup)
--   5. RLS deny-by-default + per-owner policies on both new tables
--   6. moddatetime trigger on lungnote_gmail_connections
--   7. Indexes for cron filter, lookup, and unique (user_id, message_id) dedup

-- Extensions already enabled by prior migrations (moddatetime, pgcrypto). Idempotent.
create extension if not exists "moddatetime";
create extension if not exists "pgcrypto";

-- =============================================================
-- 1. Extend lungnote_todos.source — add 'email'
-- =============================================================
alter table lungnote_todos drop constraint if exists lungnote_todos_source_check;
alter table lungnote_todos
  add constraint lungnote_todos_source_check
  check (source in ('chat', 'web', 'liff', 'email'));

-- =============================================================
-- 2. Origin tracking columns on lungnote_todos
--    nullable — existing chat/web/liff todos have no external ref.
-- =============================================================
alter table lungnote_todos
  add column if not exists source_external_id text,
  add column if not exists source_url text;

-- Dedup: only one todo per (user, source, external_id) when external_id given.
create unique index if not exists lungnote_todos_user_source_external_idx
  on lungnote_todos(user_id, source, source_external_id)
  where source_external_id is not null;

-- =============================================================
-- 3. lungnote_gmail_connections
--    One OAuth-linked Gmail per LungNote user (v1 enforces unique).
-- =============================================================
create table if not exists lungnote_gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  google_user_id text not null,
  email text not null,
  refresh_token_enc bytea not null,
  access_token_enc bytea,
  access_token_expires_at timestamptz,
  scope text not null,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'error', 'expired')),
  last_error text,
  last_history_id text,
  last_synced_at timestamptz,
  watch_expires_at timestamptz,
  watch_resource_state text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint lungnote_gmail_connections_user_unique unique (user_id)
);

create index if not exists lungnote_gmail_connections_user_id_idx
  on lungnote_gmail_connections(user_id);
create index if not exists lungnote_gmail_connections_status_idx
  on lungnote_gmail_connections(status)
  where status = 'active';
create index if not exists lungnote_gmail_connections_watch_renew_idx
  on lungnote_gmail_connections(watch_expires_at)
  where watch_expires_at is not null;

create trigger lungnote_gmail_connections_updated_at
  before update on lungnote_gmail_connections
  for each row execute function moddatetime(updated_at);

alter table lungnote_gmail_connections enable row level security;

create policy lungnote_gmail_connections_select_own
  on lungnote_gmail_connections for select using (auth.uid() = user_id);
create policy lungnote_gmail_connections_insert_own
  on lungnote_gmail_connections for insert with check (auth.uid() = user_id);
create policy lungnote_gmail_connections_update_own
  on lungnote_gmail_connections for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_gmail_connections_delete_own
  on lungnote_gmail_connections for delete using (auth.uid() = user_id);

-- =============================================================
-- 4. lungnote_gmail_synced_messages
--    Audit + dedup of every Gmail message LungNote has seen.
--    is_todo + todo_id link to lungnote_todos when AI classifies it.
-- =============================================================
create table if not exists lungnote_gmail_synced_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  connection_id uuid references lungnote_gmail_connections(id) on delete cascade not null,
  message_id text not null,
  thread_id text,
  internal_date timestamptz,
  from_truncated text,
  subject_truncated text,
  scanned_at timestamptz default now() not null,
  is_todo boolean default false not null,
  todo_id uuid references lungnote_todos(id) on delete set null,
  ai_reason text,
  constraint lungnote_gmail_synced_messages_unique unique (user_id, message_id)
);

create index if not exists lungnote_gmail_synced_messages_user_id_idx
  on lungnote_gmail_synced_messages(user_id);
create index if not exists lungnote_gmail_synced_messages_connection_id_idx
  on lungnote_gmail_synced_messages(connection_id);
create index if not exists lungnote_gmail_synced_messages_todo_id_idx
  on lungnote_gmail_synced_messages(todo_id)
  where todo_id is not null;
create index if not exists lungnote_gmail_synced_messages_user_id_scanned_at_idx
  on lungnote_gmail_synced_messages(user_id, scanned_at desc);

alter table lungnote_gmail_synced_messages enable row level security;

create policy lungnote_gmail_synced_messages_select_own
  on lungnote_gmail_synced_messages for select using (auth.uid() = user_id);
create policy lungnote_gmail_synced_messages_insert_own
  on lungnote_gmail_synced_messages for insert with check (auth.uid() = user_id);
create policy lungnote_gmail_synced_messages_update_own
  on lungnote_gmail_synced_messages for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_gmail_synced_messages_delete_own
  on lungnote_gmail_synced_messages for delete using (auth.uid() = user_id);
