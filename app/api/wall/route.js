import { tmdbFetch } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pôsteres das séries em alta, só para o fundo da tela de login. Não expõe a chave. */
export async function GET() {
  const posters = [];
  for (const page of ["1", "2"]) {
    let r;
    try { r = await tmdbFetch("trending/tv/week", { page }); } catch { continue; }
    if (!r.ok) continue;
    for (const s of (await r.json()).results || []) {
      if (s.poster_path) posters.push(`https://image.tmdb.org/t/p/w185${s.poster_path}`);
    }
  }
  return Response.json({ posters }, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400" } });
}
