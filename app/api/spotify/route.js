import { isAuthed } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let token = { value: "", until: 0 };

async function getToken() {
  if (token.value && token.until > Date.now()) return token.value;
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64") },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) return null;
  const d = await r.json();
  token = { value: d.access_token, until: Date.now() + (d.expires_in - 60) * 1000 };
  return token.value;
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const OST = /(soundtrack|trilha|music from|original score|ost\b|series music|banda sonora)/i;

/** Acha a trilha sonora de uma série no Spotify: primeiro o álbum oficial, depois uma playlist. */
export async function GET(req) {
  if (!(await isAuthed(req))) return Response.json({ error: "faça login" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 120).trim();
  if (!q) return Response.json({ item: null });
  const t = await getToken();
  if (!t) return Response.json({ item: null, configured: false });

  const search = async (query, type) => {
    const u = new URL("https://api.spotify.com/v1/search");
    u.searchParams.set("q", query);
    u.searchParams.set("type", type);
    u.searchParams.set("limit", "10");
    u.searchParams.set("market", "BR");
    const r = await fetch(u, { headers: { authorization: `Bearer ${t}` }, next: { revalidate: 86400 } });
    return r.ok ? r.json() : {};
  };

  const title = norm(q);
  const albums = (await search(`${q} soundtrack`, "album")).albums?.items || [];
  const album = albums.find((a) => a && norm(a.name).includes(title) && OST.test(a.name));
  if (album) {
    return Response.json({ item: { type: "album", id: album.id, name: album.name, url: album.external_urls?.spotify } }, { headers: { "cache-control": "private, max-age=86400" } });
  }
  const playlists = (await search(`${q} soundtrack`, "playlist")).playlists?.items || [];
  const pl = playlists.find((p) => p && norm(p.name).includes(title)) || playlists.find(Boolean);
  if (pl) {
    return Response.json({ item: { type: "playlist", id: pl.id, name: pl.name, url: pl.external_urls?.spotify } }, { headers: { "cache-control": "private, max-age=86400" } });
  }
  return Response.json({ item: null, configured: true });
}
