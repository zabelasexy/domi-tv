import { isAuthed, tmdbFetch } from "@/lib/server";

export const runtime = "nodejs";

const ALLOWED = [
  /^search\/tv$/,
  /^trending\/tv\/(day|week)$/,
  /^tv\/\d+$/,
  /^tv\/\d+\/season\/\d+$/,
  /^tv\/\d+\/recommendations$/,
  /^find\/\d+$/,
  /^discover\/tv$/,
];
const ALLOWED_PARAMS = new Set(["query", "page", "language", "append_to_response", "include_image_language", "external_source", "include_adult", "sort_by", "with_genres"]);

export async function GET(req, { params }) {
  const path = (params.path || []).join("/");
  if (!ALLOWED.some((re) => re.test(path))) return Response.json({ error: "caminho não permitido" }, { status: 404 });
  if (!(await isAuthed(req))) return Response.json({ error: "faça login" }, { status: 401 });

  const sp = {};
  for (const [k, v] of new URL(req.url).searchParams) if (ALLOWED_PARAMS.has(k)) sp[k] = v.slice(0, 200);
  if (path === "search/tv") sp.include_adult = "false";

  const r = await tmdbFetch(path, sp);
  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: { "content-type": "application/json", "cache-control": "private, max-age=3600" },
  });
}
