import { getReceipt, UUID_RE } from "@/lib/sources";

export async function GET(_request: Request, ctx: RouteContext<"/api/receipt/[id]">) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return Response.json({ error: "Not a Trace data ID" }, { status: 400 });
  const result = await getReceipt(id.toLowerCase());
  if (!result) return Response.json({ error: "Receipt not found on Trace" }, { status: 404 });
  return Response.json(result, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=600" } });
}
