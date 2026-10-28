// Checks a random sample of receipts drawn from Trace's whole history.
//
//   npx tsx scripts/audit.ts --n 1000 --seed 20261028
//
// Writes results/audit-<seed>.json (one row per receipt) and
// results/audit-<seed>.md (the summary). Same seed, same sample.

import { mkdirSync, writeFileSync } from "node:fs";
import { checkAnchored, checkFieldsUnchanged, checkSignature } from "../src/lib/checks";
import { extractReceipt } from "../src/lib/extract";
import type { ActivityEvent, AnchorTx, CheckStatus, Jwk, TraceReceipt } from "../src/lib/types";

const TRACE = "https://trace.datafdn.org";
const EXPLORER = "https://www.datanetscan.io";
const HEADERS = { "User-Agent": "check-the-receipt audit (+https://github.com/YASASWIP012/check-the-receipt)" };

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const N = arg("n", 1000);
const SEED = arg("seed", 20261028);
const CONCURRENCY = arg("concurrency", 4);

// mulberry32: small, seedable, good enough for picking sample positions.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 4): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) });
      if (res.ok || res.status === 404 || i >= tries) return res;
    } catch (e) {
      if (i >= tries) throw e;
    }
    await sleep(800 * 2 ** i);
  }
}

const cursorFor = (order: number) => Buffer.from(JSON.stringify({ read_model_order: order })).toString("base64");

async function eventsBefore(order: number, count = 1): Promise<ActivityEvent[]> {
  const res = await get(`${TRACE}/api/activity?count=${count}&cursor=${cursorFor(order)}`);
  if (!res.ok) return [];
  return (await res.json()).events ?? [];
}

async function bounds(): Promise<[number, number]> {
  const head = await (await get(`${TRACE}/api/activity?count=1`)).json();
  const max = JSON.parse(Buffer.from(head.nextCursor, "base64").toString()).read_model_order + 1;
  // Earliest position that still returns an event.
  let lo = 0;
  let hi = max;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await eventsBefore(mid)).length) hi = mid;
    else lo = mid;
  }
  return [hi, max];
}

async function pool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

interface Row {
  dataId: string;
  provider: string;
  eventKind: string;
  sampledAt: number;
  found: boolean;
  fields?: CheckStatus;
  signature?: CheckStatus;
  anchored?: CheckStatus;
  media?: string;
  kyc?: string;
  tos?: string;
  seq?: number;
  occurredAt?: string;
  ingestedAt?: string;
  tx?: string | null;
  block?: number | null;
  batchSize?: number;
}

async function main() {
  const random = rng(SEED);
  const [lo, hi] = await bounds();
  console.log(`history positions ${lo}..${hi}, seed ${SEED}`);

  // Draw positions until we have N distinct receipts.
  const picked = new Map<string, { e: ActivityEvent; order: number }>();
  while (picked.size < N) {
    const want = Math.min(N - picked.size, 200);
    const orders = Array.from({ length: want }, () => lo + Math.floor(random() * (hi - lo)));
    const found = await pool(orders, CONCURRENCY, async (o) => ({ o, e: (await eventsBefore(o))[0] }));
    for (const { o, e } of found) if (e && !picked.has(e.data_id) && picked.size < N) picked.set(e.data_id, { e, order: o });
    console.log(`sampled ${picked.size}/${N}`);
  }

  const jwksCache = new Map<string, Promise<{ keys: Jwk[] } | null>>();
  const txCache = new Map<string, Promise<AnchorTx | null>>();
  const loadJwks = (url: string) => {
    if (!jwksCache.has(url)) jwksCache.set(url, get(url).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    return jwksCache.get(url)!;
  };
  const loadTx = (hash: string) => {
    if (!txCache.has(hash))
      txCache.set(
        hash,
        get(`${EXPLORER}/api/v2/transactions/${hash}`)
          .then(async (r) => {
            if (!r.ok) return null;
            const d = await r.json();
            return { hash, rawInput: d.raw_input, blockNumber: d.block_number, timestamp: d.timestamp, method: d.method, status: d.status };
          })
          .catch(() => null),
      );
    return txCache.get(hash)!;
  };

  let done = 0;
  const rows = await pool([...picked.values()], CONCURRENCY, async ({ e, order }): Promise<Row> => {
    const base: Row = { dataId: e.data_id, provider: e.provider, eventKind: e.kind, sampledAt: order, found: false };
    const res = await get(`${TRACE}/asset/${e.data_id}`);
    const receipt: TraceReceipt | null = res.ok ? extractReceipt(await res.text()) : null;
    if (++done % 50 === 0) console.log(`checked ${done}/${picked.size}`);
    if (!receipt) return base;
    const m = receipt.initial_metadata_json;
    const [jwks, tx] = await Promise.all([
      m.attestation?.key_url ? loadJwks(m.attestation.key_url) : null,
      receipt.tx_hash ? loadTx(receipt.tx_hash) : null,
    ]);
    const anchored = checkAnchored(receipt, tx);
    return {
      ...base,
      found: true,
      fields: (await checkFieldsUnchanged(receipt)).status,
      signature: (await checkSignature(receipt, jwks)).status,
      anchored: anchored.status,
      media: m.file?.media_category,
      kyc: m.contributor?.kyc_status,
      tos: m.contributor?.consent?.tos_version,
      seq: receipt.current_seq,
      occurredAt: receipt.occurred_at,
      ingestedAt: receipt.ingested_at,
      tx: receipt.tx_hash,
      block: tx?.blockNumber ?? null,
      batchSize: anchored.evidence.batchSize ? Number(anchored.evidence.batchSize) : undefined,
    };
  });

  mkdirSync("results", { recursive: true });
  const runAt = new Date().toISOString();
  writeFileSync(`results/audit-${SEED}.json`, JSON.stringify({ runAt, seed: SEED, n: N, positions: [lo, hi], rows }, null, 2));

  const found = rows.filter((r) => r.found);
  const tally = <K extends keyof Row>(key: K) => {
    const t: Record<string, number> = {};
    for (const r of found) t[String(r[key] ?? "none")] = (t[String(r[key] ?? "none")] ?? 0) + 1;
    return Object.entries(t)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  };
  const allPass = found.filter((r) => r.fields === "pass" && r.signature === "pass" && r.anchored === "pass").length;
  const dates = found.map((r) => r.ingestedAt ?? "").filter(Boolean).sort();
  const blocks = found.map((r) => r.block).filter((b): b is number => b != null).sort((a, b) => a - b);

  const md = `# Trace receipt audit, seed ${SEED}

Run at ${runAt}. ${N} receipts drawn at random from Trace activity positions ${lo} to ${hi}.

- Receipts found on Trace: ${found.length} of ${rows.length}
- All three checks pass: ${allPass}
- Fields hash to the signed root: ${tally("fields")}
- Provider signature: ${tally("signature")}
- Found in the anchor transaction: ${tally("anchored")}
- Providers: ${tally("provider")}
- Media: ${tally("media")}
- KYC status: ${tally("kyc")}
- Terms version: ${tally("tos")}
- Metadata updated after registration (seq > 0): ${found.filter((r) => (r.seq ?? 0) > 0).length}
- Distinct anchor transactions: ${new Set(found.map((r) => r.tx).filter(Boolean)).size}
- Batch sizes: ${tally("batchSize")}
- Registered between: ${dates[0] ?? "?"} and ${dates.at(-1) ?? "?"}
- Blocks: ${blocks[0] ?? "?"} to ${blocks.at(-1) ?? "?"}
`;
  writeFileSync(`results/audit-${SEED}.md`, md);
  console.log(md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
