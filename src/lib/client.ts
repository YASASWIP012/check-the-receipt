import { checkAnchored, checkFieldsUnchanged, checkSignature } from "./checks";
import type { ActivityEvent, AnchorTx, CheckResult, Jwk, TraceReceipt } from "./types";

export interface Bundle {
  receipt: TraceReceipt;
  tx: AnchorTx | null;
  jwks: { keys: Jwk[] } | null;
  snapshot: boolean;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

export async function loadBundle(dataId: string): Promise<Bundle | null> {
  const r = await getJson<{ receipt: TraceReceipt; snapshot: boolean }>(`/api/receipt/${dataId}`);
  if (!r) return null;
  const { receipt } = r;
  const keyUrl = receipt.initial_metadata_json.attestation?.key_url;
  const [t, k] = await Promise.all([
    receipt.tx_hash ? getJson<{ tx: AnchorTx; snapshot: boolean }>(`/api/tx/${receipt.tx_hash}`) : null,
    keyUrl ? getJson<{ jwks: { keys: Jwk[] }; snapshot: boolean }>(`/api/jwks?url=${encodeURIComponent(keyUrl)}`) : null,
  ]);
  return {
    receipt,
    tx: t?.tx ?? null,
    jwks: k?.jwks ?? null,
    snapshot: Boolean(r.snapshot || t?.snapshot || k?.snapshot),
  };
}

export async function runChecks(b: Bundle): Promise<[CheckResult, CheckResult, CheckResult]> {
  return Promise.all([checkFieldsUnchanged(b.receipt), checkSignature(b.receipt, b.jwks), checkAnchored(b.receipt, b.tx)]);
}

export async function loadActivity(count = 20): Promise<ActivityEvent[]> {
  const r = await getJson<{ events: ActivityEvent[] }>(`/api/activity?count=${count}`);
  return r?.events ?? [];
}
