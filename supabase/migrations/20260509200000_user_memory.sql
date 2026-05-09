-- Persistent per-LINE-user memory. Stores arbitrary JSON facts the agent
-- has learned about the user (name, preferences, role, etc). Loaded into
-- system prompt as "USER MEMORY" block; agent updates via update_memory tool.

create table if not exists lungnote_user_memory (
  line_user_id text primary key,
  memory jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_user_memory_updated_at_idx
  on lungnote_user_memory(updated_at desc);

-- RLS: deny-by-default, service-role only (admin client bypasses).
alter table lungnote_user_memory enable row level security;
