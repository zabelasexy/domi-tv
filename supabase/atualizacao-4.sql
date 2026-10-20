-- Atualização 4: filmes.
-- Cole tudo no Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez sem problema.

create table if not exists public.movies (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tmdb_id        integer not null,
  title          text not null,
  original_title text,
  poster_path    text,
  backdrop_path  text,
  year           text,
  genres         text[] not null default '{}',
  runtime        integer,
  status         text not null default 'quero' check (status in ('visto','quero')),
  rating         numeric(2,1) not null default 0 check (rating >= 0 and rating <= 5 and rating * 2 = round(rating * 2)),
  favorite       boolean not null default false,
  rewatch_count  integer not null default 0,
  notes          text not null default '',
  watched_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, tmdb_id)
);
create index if not exists movies_watched on public.movies (user_id, watched_at);

alter table public.movies enable row level security;
drop policy if exists "dono" on public.movies;
create policy "dono" on public.movies for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists movies_touch on public.movies;
create trigger movies_touch before update on public.movies for each row execute function public.touch_updated_at();

-- (repete a atualização 3, caso ainda não tenha rodado)
alter function public.touch_updated_at() set search_path = public;
alter function public.my_stats() set search_path = public;
