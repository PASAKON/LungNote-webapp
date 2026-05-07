-- LINE bot conversation memory (rolling 5-user + 5-assistant window per LINE userId).
-- Server-only access via SUPABASE_SECRET_KEY; RLS enabled with no policies for end-user roles.
-- Convention: see wikis/20-Conventions/Database-Naming.md (lungnote_ prefix, RLS on, etc.)
-- Companion: ADR-0009 (LINE bot AI replies)

create table if not exists lungnote_conversation_memory (
  line_user_id text primary key,
  messages     jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now()
);

create index if not exists lungnote_conversation_memory_updated_at_idx
  on lungnote_conversation_memory (updated_at desc);

create trigger lungnote_conversation_memory_updated_at
  before update on lungnote_conversation_memory
  for each row execute function moddatetime(updated_at);

alter table lungnote_conversation_memory enable row level security;
-- intentionally no policies: only service_role may access

comment on table lungnote_conversation_memory is
  'Rolling 5-user + 5-assistant message window per LINE userId. App trims to last 10 entries.';
comment on column lungnote_conversation_memory.messages is
  'jsonb array of {role: ''user''|''assistant'', content: text}.';
