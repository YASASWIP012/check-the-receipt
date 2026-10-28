import { getActivity } from "@/lib/sources";

export async function GET(request: Request) {
  const count = Number(new URL(request.url).searchParams.get("count") ?? 20);
  try {
    const events = await getActivity(Number.isFinite(count) ? count : 20);
    return Response.json({ events }, { headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=30" } });
  } catch {
    return Response.json({ events: [], error: "Trace activity is unavailable right now" }, { status: 502 });
  }
}
