-- Domi TV — modo casal
-- Rode no Supabase → SQL Editor, DEPOIS do schema.sql.
-- Antes de rodar, troque os dois e-mails no final do arquivo.

create table if not exists public.couples (
  user_a     uuid not null references auth.users(id) on delete cascade,
  user_b     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b)
);
alter table public.couples enable row level security;
drop policy if exists "ver meu casal" on public.couples;
create policy "ver meu casal" on public.couples for select using (auth.uid() in (user_a, user_b));

-- Séries em que as duas deram ♥ no Match. Não expõe mais nada da outra pessoa.
create or replace function public.couple_matches()
returns table (tmdb_id integer, matched_at timestamptz)
language sql stable security definer set search_path = public as $$
  with partner as (
    select case when user_a = auth.uid() then user_b else user_a end as id
    from public.couples where auth.uid() in (user_a, user_b) limit 1
  )
  select a.tmdb_id, greatest(a.created_at, b.created_at)
  from public.swipes a
  join public.swipes b on b.tmdb_id = a.tmdb_id and b.user_id = (select id from partner)
  where a.user_id = auth.uid() and a.decision = 'quero' and b.decision = 'quero'
  order by 2 desc;
$$;

-- Só o primeiro nome (ou o começo do e-mail) da outra pessoa, para o "Deu match!".
create or replace function public.couple_partner()
returns table (name text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
  from public.couples c
  join auth.users u on u.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  where auth.uid() in (c.user_a, c.user_b)
  limit 1;
$$;

-- Séries que a outra pessoa curtiu e você ainda não viu no Match (entram misturadas nos seus cards, sem aviso).
create or replace function public.couple_pending()
returns table (tmdb_id integer)
language sql stable security definer set search_path = public as $$
  with partner as (
    select case when user_a = auth.uid() then user_b else user_a end as id
    from public.couples where auth.uid() in (user_a, user_b) limit 1
  )
  select b.tmdb_id from public.swipes b
  where b.user_id = (select id from partner) and b.decision = 'quero'
    and not exists (select 1 from public.swipes a where a.user_id = auth.uid() and a.tmdb_id = b.tmdb_id)
  order by b.created_at desc limit 30;
$$;

revoke all on function public.couple_pending() from public, anon;
grant execute on function public.couple_pending() to authenticated;
revoke all on function public.couple_matches() from public, anon;
revoke all on function public.couple_partner() from public, anon;
grant execute on function public.couple_matches() to authenticated;
grant execute on function public.couple_partner() to authenticated;

-- Liga as duas contas. TROQUE os e-mails abaixo (os mesmos cadastrados em Authentication → Users).
insert into public.couples (user_a, user_b)
select a.id, b.id from auth.users a, auth.users b
where a.email = 'EMAIL_DA_DOMI@exemplo.com' and b.email = 'SEU_EMAIL@exemplo.com'
on conflict do nothing;
