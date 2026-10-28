import { getJwks, isAllowedJwksUrl } from "@/lib/sources";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!isAllowedJwksUrl(url)) return Response.json({ error: "Only https://<host>/.well-known/jwks.json is allowed" }, { status: 400 });
  const result = await getJwks(url);
  if (!result) return Response.json({ error: "Could not load the published keys" }, { status: 502 });
  return Response.json(result, { headers: { "Cache-Control": "s-maxage=3600" } });
}
