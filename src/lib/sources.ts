import "server-only";
import featuredReceipt from "@/data/featured-receipt.json";
import featuredTx from "@/data/featured-tx.json";
import kledJwks from "@/data/kled-jwks.json";
import { extractReceipt } from "./extract";
import type { ActivityEvent, AnchorTx, Jwk, TraceReceipt } from "./types";

const TRACE = "https://trace.datafdn.org";
const EXPLORER = "https://www.datanetscan.io";
const UA = { "User-Agent": "check-the-receipt (+https://github.com)" };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TX_RE = /^0x[0-9a-f]{64}$/i;

// Pinned copies so the featured receipt still loads if a source is down.
const snapshots = {
  receipt: featuredReceipt as unknown as TraceReceipt,
  tx: featuredTx as AnchorTx,
  jwks: kledJwks as { keys: Jwk[] },
};

async function fetchText(url: string, revalidate: number): Promise<string> {
  const res = await fetch(url, { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

export async function getActivity(count: number): Promise<ActivityEvent[]> {
  const n = Math.min(Math.max(count, 1), 50);
  const body = JSON.parse(await fetchText(`${TRACE}/api/activity?count=${n}`, 5));
  return body.events as ActivityEvent[];
}

export async function getReceipt(dataId: string): Promise<{ receipt: TraceReceipt; snapshot: boolean } | null> {
  try {
    const receipt = extractReceipt(await fetchText(`${TRACE}/asset/${dataId}`, 60));
    if (receipt) return { receipt, snapshot: false };
  } catch {
    // fall through to snapshot
  }
  if (dataId === snapshots.receipt.data_id) return { receipt: snapshots.receipt, snapshot: true };
  return null;
}

export async function getTx(hash: string): Promise<{ tx: AnchorTx; snapshot: boolean } | null> {
  try {
    const d = JSON.parse(await fetchText(`${EXPLORER}/api/v2/transactions/${hash}`, 86400));
    if (d.raw_input) {
      return {
        tx: {
          hash,
          rawInput: d.raw_input,
          blockNumber: d.block_number ?? null,
          timestamp: d.timestamp ?? null,
          method: d.method ?? null,
          status: d.status ?? null,
        },
        snapshot: false,
      };
    }
  } catch {
    // fall through to snapshot
  }
  if (hash.toLowerCase() === snapshots.tx.hash.toLowerCase()) return { tx: snapshots.tx, snapshot: true };
  return null;
}

// Only fetch key sets from the standard well-known path on a public https host.
export function isAllowedJwksUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.pathname === "/.well-known/jwks.json" &&
      !/^[\d.]+$|localhost|\[/.test(u.hostname) &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

export async function getJwks(url: string): Promise<{ jwks: { keys: Jwk[] }; snapshot: boolean } | null> {
  try {
    return { jwks: JSON.parse(await fetchText(url, 3600)), snapshot: false };
  } catch {
    if (url === "https://www.kled.ai/.well-known/jwks.json") return { jwks: snapshots.jwks, snapshot: true };
    return null;
  }
}
