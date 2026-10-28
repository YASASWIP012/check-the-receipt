import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkAnchored, checkFieldsUnchanged, checkFile, checkSignature } from "../src/lib/checks";
import { decodeRegisterBatch } from "../src/lib/calldata";
import { canonicalJson } from "../src/lib/hash";
import type { AnchorTx, Jwk, TraceReceipt } from "../src/lib/types";

const load = <T>(name: string): T => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
const clone = <T>(v: T): T => structuredClone(v);

const jwks = load<{ keys: Jwk[] }>("kled-jwks.json");
const cases = ["single", "batched"].map((name) => ({
  name,
  receipt: load<TraceReceipt>(`${name}-receipt.json`),
  tx: load<AnchorTx>(`${name}-tx.json`),
}));

describe("canonicalJson", () => {
  it("sorts keys at every level and drops whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { f: 1, e: 0 }], c: "x" } })).toBe(
      '{"a":{"c":"x","d":[2,{"e":0,"f":1}]},"b":1}',
    );
  });
});

describe("registerBatch decoding", () => {
  it("reads one record from a single-entry batch", () => {
    const records = decodeRegisterBatch(cases[0].tx.rawInput);
    expect(records).toHaveLength(1);
    expect(records[0].dataId).toBe("d6fa7d84afbe5aebacd5795ca63642ad");
  });

  it("reads every record from a 30-entry batch", () => {
    expect(decodeRegisterBatch(cases[1].tx.rawInput)).toHaveLength(30);
  });

  it("rejects other calls", () => {
    expect(() => decodeRegisterBatch("0xa9059cbb" + "0".repeat(128))).toThrow();
  });
});

describe.each(cases)("$name receipt from Trace", ({ receipt, tx }) => {
  it("fields hash to the signed metadata root", async () => {
    expect((await checkFieldsUnchanged(receipt)).status).toBe("pass");
  });

  it("signature verifies against the published key", async () => {
    expect((await checkSignature(receipt, jwks)).status).toBe("pass");
  });

  it("root and file hash appear in the anchor transaction", () => {
    expect(checkAnchored(receipt, tx).status).toBe("pass");
  });

  it("notices one edited field", async () => {
    const edited = clone(receipt);
    edited.initial_metadata_json.contributor!.kyc_country = "FR";
    expect((await checkFieldsUnchanged(edited)).status).toBe("mismatch");
  });

  it("rejects a signature over a different hash", async () => {
    const edited = clone(receipt);
    edited.initial_metadata_json.attestation!.payload_hash = "sha256:" + "0".repeat(64);
    expect((await checkSignature(edited, jwks)).status).toBe("mismatch");
  });

  it("rejects a file hash that is not on chain", () => {
    const edited = clone(receipt);
    edited.initial_metadata_json.file!.content_sha256 = "sha256:" + "1".repeat(64);
    expect(checkAnchored(edited, tx).status).toBe("mismatch");
  });

  it("reports a receipt with no anchor yet as waiting", () => {
    expect(checkAnchored({ ...receipt, tx_hash: null }, null).status).toBe("waiting");
  });

  it("rejects a file whose bytes differ", async () => {
    expect((await checkFile(receipt, new TextEncoder().encode("not the photo").buffer)).status).toBe("mismatch");
  });
});

describe("receipt from an app that doesn't sign", () => {
  const receipt = load<TraceReceipt>("unsigned-receipt.json");
  const tx = load<AnchorTx>("unsigned-tx.json");

  it("still hashes to its registered root", async () => {
    expect((await checkFieldsUnchanged(receipt)).status).toBe("pass");
  });

  it("reports the signature as not checkable rather than failed", async () => {
    expect((await checkSignature(receipt, jwks)).status).toBe("unavailable");
  });

  it("is still found in its anchor transaction", () => {
    expect(checkAnchored(receipt, tx).status).toBe("pass");
  });
});

describe("unsigned receipt whose public fields don't rebuild its root", () => {
  const receipt = load<TraceReceipt>("unreproducible-receipt.json");
  const tx = load<AnchorTx>("unreproducible-tx.json");

  it("is reported as not reproducible, not as changed", async () => {
    const r = await checkFieldsUnchanged(receipt);
    expect(r.status).toBe("unavailable");
    expect(r.evidence.note).toMatch(/not reproducible/);
  });

  it("still has its root on chain", () => {
    expect(checkAnchored(receipt, tx).status).toBe("pass");
  });
});
