// Check one Trace receipt with nothing but Node 20+.
//   node scripts/verify-one.mjs d6fa7d84-afbe-5aeb-acd5-795ca63642ad
import { webcrypto as c } from "node:crypto";

const id = process.argv[2];
const text = (u) => fetch(u).then((r) => r.text());
const hex = (b) => Buffer.from(b).toString("hex");
const canon = (v) =>
  Array.isArray(v) ? `[${v.map(canon).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`
  : JSON.stringify(v);

// 0. The receipt, exactly as Trace publishes it.
const html = await text(`https://trace.datafdn.org/asset/${id}`);
const r = JSON.parse(decodeURIComponent(html.match(/href="data:application\/json;charset=utf-8,([^"]+)"/)[1].replace(/&amp;/g, "&")));
const { attestation: att, ...fields } = r.initial_metadata_json;
const root = r.initial_metadata_root.replace("sha256:", "");

// 1. The fields hash to the root.
const computed = hex(await c.subtle.digest("SHA-256", new TextEncoder().encode(canon(fields))));
console.log("1 fields hash to root:", computed === root);

// 2. The provider's signature over "sha256:<root>" verifies with its published key.
if (att) {
  const jwk = JSON.parse(await text(att.key_url)).keys.find((k) => k.kid === att.key_id);
  const key = await c.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const ok = await c.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, Buffer.from(att.signature, "base64url"), new TextEncoder().encode(att.payload_hash));
  console.log("2 signature verifies:", ok, `(${att.key_url})`);
} else console.log("2 no provider signature on this receipt");

// 3. The anchor transaction's calldata carries this data ID, the root and the file hash.
const tx = JSON.parse(await text(`https://www.datanetscan.io/api/v2/transactions/${r.tx_hash}`));
const words = tx.raw_input.slice(10).match(/.{64}/g);
const count = parseInt(words[1], 16);
const rec = Array.from({ length: count }, (_, i) => words.slice(2 + i * 6, 8 + i * 6)).find((w) => w[2].startsWith(id.replace(/-/g, "")));
const file = r.initial_metadata_json.file.content_sha256.replace("sha256:", "");
console.log("3 in anchor tx:", Boolean(rec && rec[4] === root && rec[5] === file), `(block ${tx.block_number}, batch of ${count})`);
