-- Create boards table
create table if not exists boards (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Untitled Board',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Create board_objects table
create table if not exists board_objects (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references boards(id) on delete cascade,
  type text not null check (type in ('sticky_note','rectangle','circle','line','connector','frame','text')),
  properties jsonb not null default '{}',
  x double precision not null default 0,
  y double precision not null default 0,
  width double precision not null default 100,
  height double precision not null default 100,
  z_index integer not null default 0,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by board
create index if not exists idx_board_objects_board_id on board_objects(board_id);

-- Full row in DELETE events so realtime listeners get the deleted object
alter table board_objects replica identity full;

-- Add to realtime publication
alter publication supabase_realtime add table board_objects;

-- RLS policies (MVP: all authenticated users can CRUD)
alter table boards enable row level security;
alter table board_objects enable row level security;

create policy "Authenticated users can read boards"
  on boards for select to authenticated using (true);

create policy "Authenticated users can insert boards"
  on boards for insert to authenticated with check (true);

create policy "Authenticated users can update boards"
  on boards for update to authenticated using (true) with check (true);

create policy "Authenticated users can read board_objects"
  on board_objects for select to authenticated using (true);

create policy "Authenticated users can insert board_objects"
  on board_objects for insert to authenticated with check (true);

create policy "Authenticated users can update board_objects"
  on board_objects for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete board_objects"
  on board_objects for delete to authenticated using (true);

-- Seed a default board
insert into boards (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Default Board')
on conflict (id) do nothing;
