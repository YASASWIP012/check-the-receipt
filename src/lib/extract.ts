import type { TraceReceipt } from "./types";

// Trace renders each receipt server-side and embeds the full record as a
// downloadable data: URL on the receipt page.
export function extractReceipt(html: string): TraceReceipt | null {
  const m = html.match(/href="data:application\/json;charset=utf-8,([^"]+)"/);
  if (!m) return null;
  return JSON.parse(decodeURIComponent(m[1].replace(/&amp;/g, "&")));
}
