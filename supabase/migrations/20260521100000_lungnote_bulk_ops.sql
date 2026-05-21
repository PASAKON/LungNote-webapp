create table public.lungnote_bulk_ops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  op_kind text not null check (op_kind in ('complete','delete','uncomplete')),
  todo_ids uuid[] not null,
  created_at timestamptz not null default now()
);
create index on public.lungnote_bulk_ops (user_id, created_at desc);
alter table public.lungnote_bulk_ops enable row level security;
