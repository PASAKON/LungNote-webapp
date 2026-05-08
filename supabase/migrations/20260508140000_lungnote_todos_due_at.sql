-- ADR-0012: Unify note + todo into single memory item.
-- Adds: due_at (when), due_text (raw natural-language phrase), source (origin).
-- Raises text cap 500 → 2000 to fit chat-captured longer thoughts.

alter table lungnote_todos
  add column if not exists due_at timestamptz,
  add column if not exists due_text text,
  add column if not exists source text not null default 'web';

-- Tighten source domain
alter table lungnote_todos drop constraint if exists lungnote_todos_source_check;
alter table lungnote_todos
  add constraint lungnote_todos_source_check
  check (source in ('chat', 'web', 'liff'));

-- Raise text cap
alter table lungnote_todos drop constraint if exists lungnote_todos_text_check;
alter table lungnote_todos
  add constraint lungnote_todos_text_check
  check (length(text) between 1 and 2000);

-- Indexes for due-soon query and source filter
create index if not exists lungnote_todos_user_id_due_at_idx
  on lungnote_todos(user_id, due_at)
  where due_at is not null;
create index if not exists lungnote_todos_user_id_source_idx
  on lungnote_todos(user_id, source);
