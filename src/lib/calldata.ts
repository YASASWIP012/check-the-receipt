// Decodes Sha256DataRegistry.registerBatch calldata on the DATA Network.
// Layout (ABI-encoded dynamic array of 6-word tuples):
//   selector | offset | length | n x (eventHash, providerTag, dataId, seq, metadataRoot, contentSha256)
// The field names after eventHash are inferred from matching live receipts;
// the contract source does not label them in calldata.

export const REGISTER_BATCH_SELECTOR = "06c2dabd";

export interface AnchoredRecord {
  index: number;
  eventHash: string;
  providerTag: string;
  dataId: string;
  seq: number;
  metadataRoot: string;
  contentSha256: string;
}

export function decodeRegisterBatch(rawInput: string): AnchoredRecord[] {
  const hex = rawInput.replace(/^0x/, "").toLowerCase();
  if (!hex.startsWith(REGISTER_BATCH_SELECTOR)) {
    throw new Error("Not a registerBatch call");
  }
  const words = hex.slice(8).match(/.{64}/g) ?? [];
  const offsetWords = parseInt(words[0] ?? "0", 16) / 32;
  const count = parseInt(words[offsetWords] ?? "0", 16);
  const start = offsetWords + 1;
  if (words.length < start + count * 6) {
    throw new Error("Calldata shorter than its declared batch size");
  }
  const records: AnchoredRecord[] = [];
  for (let i = 0; i < count; i++) {
    const w = words.slice(start + i * 6, start + i * 6 + 6);
    records.push({
      index: i,
      eventHash: w[0],
      providerTag: w[1],
      dataId: w[2].slice(0, 32),
      seq: parseInt(w[3], 16),
      metadataRoot: w[4],
      contentSha256: w[5],
    });
  }
  return records;
}

export function uuidToHex(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}
