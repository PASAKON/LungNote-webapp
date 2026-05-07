-- LungNote schema hierarchy: Folder → Notebook → Note → Todo + Tag (M:N)
-- See ADR-0009 for rationale.
-- Convention: wikis/20-Conventions/Database-Naming.md

create extension if not exists "moddatetime";
create extension if not exists "pgcrypto";

-- =============================================================
-- lungnote_folders
--   Optional grouping for notebooks. Self-referential for nesting.
--   App layer should cap depth (recommend ≤ 3).
-- =============================================================
create table if not exists lungnote_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  parent_folder_id uuid references lungnote_folders(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_folders_user_id_idx
  on lungnote_folders(user_id);
create index if not exists lungnote_folders_parent_folder_id_idx
  on lungnote_folders(parent_folder_id);

create trigger lungnote_folders_updated_at
  before update on lungnote_folders
  for each row execute function moddatetime(updated_at);

alter table lungnote_folders enable row level security;
create policy lungnote_folders_select_own
  on lungnote_folders for select using (auth.uid() = user_id);
create policy lungnote_folders_insert_own
  on lungnote_folders for insert with check (auth.uid() = user_id);
create policy lungnote_folders_update_own
  on lungnote_folders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_folders_delete_own
  on lungnote_folders for delete using (auth.uid() = user_id);

-- =============================================================
-- lungnote_notebooks
--   Container of notes. Optionally inside a folder.
-- =============================================================
create table if not exists lungnote_notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  folder_id uuid references lungnote_folders(id) on delete set null,
  name text not null check (length(name) between 1 and 100),
  cover_color text not null default '#6aab8e' check (cover_color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_notebooks_user_id_idx
  on lungnote_notebooks(user_id);
create index if not exists lungnote_notebooks_folder_id_idx
  on lungnote_notebooks(folder_id);
create index if not exists lungnote_notebooks_user_id_updated_at_idx
  on lungnote_notebooks(user_id, updated_at desc);

create trigger lungnote_notebooks_updated_at
  before update on lungnote_notebooks
  for each row execute function moddatetime(updated_at);

alter table lungnote_notebooks enable row level security;
create policy lungnote_notebooks_select_own
  on lungnote_notebooks for select using (auth.uid() = user_id);
create policy lungnote_notebooks_insert_own
  on lungnote_notebooks for insert with check (auth.uid() = user_id);
create policy lungnote_notebooks_update_own
  on lungnote_notebooks for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_notebooks_delete_own
  on lungnote_notebooks for delete using (auth.uid() = user_id);

-- =============================================================
-- lungnote_notes — alter to add notebook_id (nullable for flat notes)
-- =============================================================
alter table lungnote_notes
  add column if not exists notebook_id uuid
    references lungnote_notebooks(id) on delete set null;

create index if not exists lungnote_notes_notebook_id_idx
  on lungnote_notes(notebook_id);

-- =============================================================
-- lungnote_todos
--   Checklist items inside a note. Ordered by `position`.
-- =============================================================
create table if not exists lungnote_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  note_id uuid references lungnote_notes(id) on delete cascade not null,
  text text not null check (length(text) between 1 and 500),
  done boolean default false not null,
  position integer default 0 not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists lungnote_todos_user_id_idx
  on lungnote_todos(user_id);
create index if not exists lungnote_todos_note_id_position_idx
  on lungnote_todos(note_id, position);

create trigger lungnote_todos_updated_at
  before update on lungnote_todos
  for each row execute function moddatetime(updated_at);

alter table lungnote_todos enable row level security;
create policy lungnote_todos_select_own
  on lungnote_todos for select using (auth.uid() = user_id);
create policy lungnote_todos_insert_own
  on lungnote_todos for insert with check (auth.uid() = user_id);
create policy lungnote_todos_update_own
  on lungnote_todos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_todos_delete_own
  on lungnote_todos for delete using (auth.uid() = user_id);

-- =============================================================
-- lungnote_tags
--   User-owned labels. UNIQUE per user on lowercase(name).
-- =============================================================
create table if not exists lungnote_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null check (length(name) between 1 and 40),
  color text not null default '#f0d87a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists lungnote_tags_user_id_name_lower_idx
  on lungnote_tags(user_id, lower(name));
create index if not exists lungnote_tags_user_id_idx
  on lungnote_tags(user_id);

create trigger lungnote_tags_updated_at
  before update on lungnote_tags
  for each row execute function moddatetime(updated_at);

alter table lungnote_tags enable row level security;
create policy lungnote_tags_select_own
  on lungnote_tags for select using (auth.uid() = user_id);
create policy lungnote_tags_insert_own
  on lungnote_tags for insert with check (auth.uid() = user_id);
create policy lungnote_tags_update_own
  on lungnote_tags for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lungnote_tags_delete_own
  on lungnote_tags for delete using (auth.uid() = user_id);

-- =============================================================
-- lungnote_notes_tags — junction
--   Composite PK; no surrogate id.
-- =============================================================
create table if not exists lungnote_notes_tags (
  note_id uuid references lungnote_notes(id) on delete cascade not null,
  tag_id uuid references lungnote_tags(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (note_id, tag_id)
);

create index if not exists lungnote_notes_tags_tag_id_idx
  on lungnote_notes_tags(tag_id);

alter table lungnote_notes_tags enable row level security;
create policy lungnote_notes_tags_all_own
  on lungnote_notes_tags for all
  using (
    exists (select 1 from lungnote_notes where id = note_id and user_id = auth.uid())
    and exists (select 1 from lungnote_tags where id = tag_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from lungnote_notes where id = note_id and user_id = auth.uid())
    and exists (select 1 from lungnote_tags where id = tag_id and user_id = auth.uid())
  );
