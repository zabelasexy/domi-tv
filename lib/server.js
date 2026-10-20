import { createClient } from "@supabase/supabase-js";

const verified = new Map();

/** Confere se o pedido vem de alguém logado no Domi TV (token do Supabase). */
export async function isAuthed(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const until = verified.get(token);
  if (until && until > Date.now()) return true;
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await s.auth.getUser(token);
  if (error || !data?.user) return false;
  if (verified.size > 200) verified.clear();
  verified.set(token, Date.now() + 5 * 60 * 1000);
  return true;
}

export async function tmdbFetch(path, params = {}) {
  const key = process.env.TMDB_API_KEY || "";
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("language")) url.searchParams.set("language", "pt-BR");
  const headers = { accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);
  return fetch(url, { headers, next: { revalidate: 21600 } });
}
