import { getTx, TX_RE } from "@/lib/sources";

export async function GET(_request: Request, ctx: RouteContext<"/api/tx/[hash]">) {
  const { hash } = await ctx.params;
  if (!TX_RE.test(hash)) return Response.json({ error: "Not a transaction hash" }, { status: 400 });
  const result = await getTx(hash.toLowerCase());
  if (!result) return Response.json({ error: "Transaction not found" }, { status: 404 });
  return Response.json(result, { headers: { "Cache-Control": "s-maxage=86400" } });
}
