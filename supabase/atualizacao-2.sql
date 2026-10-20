-- Domi TV — atualização 2: meia estrela + foto de perfil
-- Rode no Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez sem problema.

-- 1) Nota com meia estrela (0; 0,5; 1; ... 5)
alter table public.shows drop constraint if exists shows_rating_check;
alter table public.shows alter column rating type numeric(2,1) using rating::numeric(2,1);
alter table public.shows add constraint shows_rating_check check (rating >= 0 and rating <= 5 and rating * 2 = round(rating * 2));

-- 2) Pasta pública para fotos de perfil (cada pessoa só mexe na própria pasta)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatar: ver a propria" on storage.objects;
drop policy if exists "avatar: enviar a propria" on storage.objects;
drop policy if exists "avatar: trocar a propria" on storage.objects;
drop policy if exists "avatar: apagar a propria" on storage.objects;
create policy "avatar: ver a propria" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: enviar a propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: trocar a propria" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar: apagar a propria" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
