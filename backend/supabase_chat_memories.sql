create table if not exists public.chat_memories (
  user_id text primary key,
  sessions jsonb not null default '[]'::jsonb,
  active_session_id text not null default '',
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists chat_memories_updated_at_idx
  on public.chat_memories (updated_at desc);

alter table public.chat_memories disable row level security;
