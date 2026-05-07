-- LungNote initial schema
-- Convention: see wikis/20-Conventions/Database-Naming.md (lungnote_ prefix, RLS on, etc.)
-- Auth model: ADR-0008 (LINE-only, synthetic email, account linking via one-time token)

create extension if not exists "moddatetime";
create extension if not exists "pgcrypto";

-- =============================================================
-- helper: trigger function set_updated_at()
-- (moddatetime extension provides this; aliased for clarity)
-- =============================================================

-- =============================================================
-- lungnote_profiles
--   1:1 with auth.users (id = auth.users.id)
--   stores LINE-derived profile snapshot
-- =============================================================
create table if not exists lungnote_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  line_user_id text unique not null,
  line_display_name text,
  line_picture_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_profiles_line_user_id_idx
  on lungnote_profiles(line_user_id);

create trigger lungnote_profiles_updated_at
  before update on lungnote_profiles
  for each row execute function moddatetime(updated_at);

alter table lungnote_profiles enable row level security;

-- user reads own profile
create policy lungnote_profiles_select_own
  on lungnote_profiles for select
  using (auth.uid() = id);

-- user updates own profile (display name etc.)
create policy lungnote_profiles_update_own
  on lungnote_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- inserts only via service_role (server upsert in /auth/line)

-- =============================================================
-- lungnote_auth_link_tokens
--   server-only — stores sha256 hash of one-time tokens
--   no RLS policy = no anon/authenticated access
-- =============================================================
create table if not exists lungnote_auth_link_tokens (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists lungnote_auth_link_tokens_hash_idx
  on lungnote_auth_link_tokens(token_hash);

create index if not exists lungnote_auth_link_tokens_line_user_id_idx
  on lungnote_auth_link_tokens(line_user_id);

create index if not exists lungnote_auth_link_tokens_expires_at_idx
  on lungnote_auth_link_tokens(expires_at);

alter table lungnote_auth_link_tokens enable row level security;
-- intentionally no policies — only service_role may access

-- =============================================================
-- lungnote_notes
--   user-owned notes (Dashboard MVP)
-- =============================================================
create table if not exists lungnote_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null check (length(title) between 1 and 200),
  body text default '' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_notes_user_id_idx
  on lungnote_notes(user_id);

create index if not exists lungnote_notes_user_id_updated_at_idx
  on lungnote_notes(user_id, updated_at desc);

create trigger lungnote_notes_updated_at
  before update on lungnote_notes
  for each row execute function moddatetime(updated_at);

alter table lungnote_notes enable row level security;

create policy lungnote_notes_select_own
  on lungnote_notes for select
  using (auth.uid() = user_id);

create policy lungnote_notes_insert_own
  on lungnote_notes for insert
  with check (auth.uid() = user_id);

create policy lungnote_notes_update_own
  on lungnote_notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy lungnote_notes_delete_own
  on lungnote_notes for delete
  using (auth.uid() = user_id);
