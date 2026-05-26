-- ADR-0022 (slice C): record replies sent back to email-sourced todos.
-- One successful reply per todo (idempotent send guard via partial unique index).

create extension if not exists "pgcrypto";

create table if not exists lungnote_email_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  todo_id uuid references lungnote_todos(id) on delete cascade not null,
  thread_id text,
  message_id text,            -- original message that was replied to
  body text not null check (length(body) between 1 and 5000),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  gmail_message_id text,      -- id of the sent reply (when status='sent')
  error text,
  created_at timestamptz default now() not null
);

create index if not exists lungnote_email_replies_todo_id_idx
  on lungnote_email_replies(todo_id);
create index if not exists lungnote_email_replies_user_id_idx
  on lungnote_email_replies(user_id);

-- At most one SENT reply per todo — the "can't send twice" guarantee.
create unique index if not exists lungnote_email_replies_one_sent_per_todo
  on lungnote_email_replies(todo_id)
  where status = 'sent';

alter table lungnote_email_replies enable row level security;

create policy lungnote_email_replies_select_own
  on lungnote_email_replies for select using (auth.uid() = user_id);
create policy lungnote_email_replies_insert_own
  on lungnote_email_replies for insert with check (auth.uid() = user_id);
