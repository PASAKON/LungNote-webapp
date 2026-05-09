-- Chat trace store — admin debug viewer (planned for admin.lungnote.com).
-- One row per LINE webhook turn. Fire-and-forget insert from the webhook
-- handler so reply latency is never blocked.

create table if not exists lungnote_chat_traces (
  id uuid primary key default gen_random_uuid(),
  trace_id text not null,                  -- = LINE message.id (unique per turn)
  line_user_id text,
  user_text text not null,
  path text not null check (
    path in ('dashboard', 'list', 'memory', 'regex', 'ai', 'error')
  ),
  history_count int default 0,
  ai_iterations int default 0,
  tool_calls jsonb,                        -- [{name, args, result}]
  reply_text text,
  meta jsonb,                              -- {model, tokens_in, tokens_out, cost_usd, latency_ms}
  error_text text,
  created_at timestamptz default now() not null
);

create index if not exists lungnote_chat_traces_user_created_idx
  on lungnote_chat_traces(line_user_id, created_at desc);
create index if not exists lungnote_chat_traces_path_created_idx
  on lungnote_chat_traces(path, created_at desc);
create index if not exists lungnote_chat_traces_trace_id_idx
  on lungnote_chat_traces(trace_id);
create index if not exists lungnote_chat_traces_created_at_idx
  on lungnote_chat_traces(created_at desc);

-- RLS: deny-by-default. Reads happen via service-role client + app-layer
-- email/userId allowlist (ADMIN_LINE_USER_IDS env). No end-user policies.
alter table lungnote_chat_traces enable row level security;
