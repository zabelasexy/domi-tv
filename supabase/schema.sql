-- Domi TV — banco de dados
-- Cole tudo no Supabase → SQL Editor → New query → Run.
-- Cada pessoa só enxerga e altera as próprias linhas (Row Level Security).

create table if not exists public.shows (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id       integer not null,
  title         text not null,
  original_title text,
  poster_path   text,
  backdrop_path text,
  year          text,
  genres        text[] not null default '{}',
  status        text not null default 'quero'
                check (status in ('assistindo','finalizada','quero','geladeira','abandonada')),
  rating        smallint not null default 0 check (rating between 0 and 5),
  favorite      boolean not null default false,
  ship          text not null default '',
  tags          text[] not null default '{}',
  notes         text not null default '',
  seasons_total integer,
  episodes_total integer,
  runtime       integer,
  started_at    date,
  finished_at   date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, tmdb_id)
);

create table if not exists public.episodes_watched (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_show_id  integer not null,
  season        integer not null,
  episode       integer not null,
  runtime       integer not null default 45,
  watched_at    timestamptz not null default now(),
  unique (user_id, tmdb_show_id, season, episode)
);
create index if not exists episodes_watched_date on public.episodes_watched (user_id, watched_at);

create table if not exists public.swipes (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id    integer not null,
  decision   text not null check (decision in ('quero','nao','vi')),
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id)
);

alter table public.shows            enable row level security;
alter table public.episodes_watched enable row level security;
alter table public.swipes           enable row level security;

drop policy if exists "dono" on public.shows;
drop policy if exists "dono" on public.episodes_watched;
drop policy if exists "dono" on public.swipes;
create policy "dono" on public.shows            for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono" on public.episodes_watched for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "dono" on public.swipes           for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists shows_touch on public.shows;
create trigger shows_touch before update on public.shows for each row execute function public.touch_updated_at();

-- totais rápidos para a tela inicial
create or replace function public.my_stats()
returns table (episodes bigint, minutes bigint)
language sql stable security invoker set search_path = public as $$
  select count(*), coalesce(sum(runtime), 0)
  from public.episodes_watched where user_id = auth.uid();
$$;
