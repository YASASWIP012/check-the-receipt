import { decodeRegisterBatch, uuidToHex } from "./calldata";
import { base64UrlToBytes, canonicalJson, sha256Hex, stripPrefix } from "./hash";
import type { AnchorTx, CheckResult, Jwk, TraceReceipt } from "./types";

// Check 1: do the receipt's fields still hash to the root the app signed?
export async function checkFieldsUnchanged(receipt: TraceReceipt): Promise<CheckResult> {
  const meta = receipt.initial_metadata_json;
  const { attestation, ...signedFields } = meta;
  const computed = await sha256Hex(canonicalJson(signedFields));
  const root = stripPrefix(receipt.initial_metadata_root);
  const signed = stripPrefix(attestation?.payload_hash);
  const evidence = {
    computed: `sha256:${computed}`,
    receiptRoot: receipt.initial_metadata_root,
    signedPayloadHash: attestation?.payload_hash ?? "",
    hashedBytes: String(canonicalJson(signedFields).length),
  };
  if (!root) return { status: "unavailable", evidence };
  const matches = computed === root && (!signed || signed === root);
  return { status: matches ? "pass" : "mismatch", evidence };
}

// Check 2: does the provider's ES256 signature verify against its published key?
export async function checkSignature(receipt: TraceReceipt, jwks: { keys: Jwk[] } | null): Promise<CheckResult> {
  const att = receipt.initial_metadata_json.attestation;
  const evidence: Record<string, string> = {
    algorithm: att?.algorithm ?? "",
    keyId: att?.key_id ?? "",
    keyUrl: att?.key_url ?? "",
    signedMessage: att?.payload_hash ?? "",
    signature: att?.signature ?? "",
    signedAt: att?.signed_at_utc ?? "",
  };
  if (!att || att.algorithm !== "ES256" || !jwks) return { status: "unavailable", evidence };
  const jwk = jwks.keys.find((k) => k.kid === att.key_id);
  if (!jwk) return { status: "unavailable", evidence: { ...evidence, note: "key id not found in published keys" } };
  evidence.publicKeyX = jwk.x;
  evidence.publicKeyY = jwk.y;

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const sig = base64UrlToBytes(att.signature);
  if (sig.length !== 64) return { status: "mismatch", evidence };
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    sig as BufferSource,
    new TextEncoder().encode(att.payload_hash),
  );
  return { status: ok ? "pass" : "mismatch", evidence };
}

// Check 3: is this exact receipt inside the transaction it says anchored it?
export function checkAnchored(receipt: TraceReceipt, tx: AnchorTx | null): CheckResult {
  const evidence: Record<string, string> = { txHash: receipt.tx_hash ?? "" };
  if (!receipt.tx_hash) return { status: "waiting", evidence };
  if (!tx?.rawInput) return { status: "unavailable", evidence };

  let records;
  try {
    records = decodeRegisterBatch(tx.rawInput);
  } catch {
    return { status: "unavailable", evidence: { ...evidence, note: "unrecognised transaction format" } };
  }
  const id = uuidToHex(receipt.data_id);
  const match = records.find((r) => r.dataId === id);
  evidence.block = tx.blockNumber != null ? String(tx.blockNumber) : "";
  evidence.blockTime = tx.timestamp ?? "";
  evidence.batchSize = String(records.length);
  if (!match) return { status: "mismatch", evidence: { ...evidence, note: "data id not in this batch" } };

  const rootOk = match.metadataRoot === stripPrefix(receipt.initial_metadata_root);
  const fileOk = match.contentSha256 === stripPrefix(receipt.initial_metadata_json.file?.content_sha256);
  Object.assign(evidence, {
    positionInBatch: `${match.index + 1} of ${records.length}`,
    onchainDataId: match.dataId,
    onchainMetadataRoot: match.metadataRoot,
    onchainFileSha256: match.contentSha256,
  });
  return { status: rootOk && fileOk ? "pass" : "mismatch", evidence };
}

// Check 4: is a local file byte-for-byte the file this receipt describes?
export async function checkFile(receipt: TraceReceipt, file: ArrayBuffer): Promise<CheckResult> {
  const expected = stripPrefix(receipt.initial_metadata_json.file?.content_sha256);
  const actual = await sha256Hex(file);
  return {
    status: expected && actual === expected ? "pass" : "mismatch",
    evidence: { expected: `sha256:${expected}`, actual: `sha256:${actual}`, bytes: String(file.byteLength) },
  };
}
