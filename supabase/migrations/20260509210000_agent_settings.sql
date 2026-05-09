-- Singleton settings row for the LungNote LINE bot. Lets admin hot-swap
-- the system prompt without a redeploy (ClaudeFlow pattern). When
-- system_prompt_override is NULL, runtime falls back to the hardcoded
-- buildStaticSystemPrompt() — so this row is optional.
--
-- Why a table not a env var: Vercel envs need a redeploy to apply,
-- block prompt experimentation. A DB row + 60s in-memory cache lets
-- you tweak the prompt and see the next webhook reflect the change.

create table if not exists lungnote_agent_settings (
  id text primary key default 'default'
    check (id = 'default'),
  system_prompt_override text,
  notes text,
  updated_at timestamptz default now() not null
);

-- Seed the singleton row so reads never miss.
insert into lungnote_agent_settings (id, system_prompt_override, notes)
values ('default', null, 'Hot-swap the static system prompt here. NULL = use code default.')
on conflict (id) do nothing;

-- RLS: deny-by-default, service-role only (admin client bypasses).
alter table lungnote_agent_settings enable row level security;
