# Check the receipt

Trace, the DATA Foundation's registry for AI training data, has recorded more than 250 million receipts. Each one says where a file came from, which app collected it, which terms the contributor accepted, and when it was registered.

[check-the-receipt.vercel.app](https://check-the-receipt.vercel.app) lets anyone pick one of those receipts and check what it claims, in the browser, with no wallet or account. It runs three checks on public data, plus a fourth if you hold the original file.

| Question | What runs |
|---|---|
| Has anything changed since the app signed it? | SHA-256 of the receipt's fields (keys sorted, no whitespace, `attestation` removed) compared with `initial_metadata_root` and the signed `payload_hash` |
| Did the app really sign it? | ES256 (ECDSA P-256, SHA-256) over the ASCII string `sha256:<root>`, checked with WebCrypto against the key at the receipt's `key_url` |
| Is it recorded on a public blockchain? | The anchor transaction's `registerBatch` calldata is decoded, and the receipt's data ID, root and file SHA-256 are found inside it |
| Is this the actual file? | SHA-256 of a file you drop, compared with `content_sha256`. The file stays on your device |

Each check also says what it doesn't prove. A valid signature shows the app vouched for those exact fields at that moment. It says nothing about whether the consent was informed or the rights are valid.

## What we found

All three public checks can be run by an outsider today, using only what Trace, the provider and the DATA Network explorer publish.

- The metadata root is the SHA-256 of the canonical JSON of the receipt's fields, without the `attestation` block.
- Kled signs that root and publishes its key at `https://www.kled.ai/.well-known/jwks.json`. Numo receipts carry no provider signature, so check 2 doesn't apply to them.
- `registerBatch(bytes)` on the `Sha256DataRegistry` contract takes an array of six-word records. The third word holds the data ID, the fifth the metadata root, and the sixth the file's SHA-256. The `Registered` event only carries an event hash, so the link is visible in the calldata, not the logs.
- Consent terms are pinned by version and hash. The hash of Kled's public terms page doesn't match the pinned value, probably because a different form of the document was hashed, so the page treats that as "version pinned" and doesn't claim more.

## 1,000 random receipts

On Oct 28, 2026 the audit script drew 1,000 receipts at random from Trace's history (registered between Jul 1 and Oct 26, 2026) and ran the three public checks on each.

| Check | Result |
|---|---|
| Found in its anchor transaction, with matching root and file hash | 1,000 of 1,000 |
| Kled signature verifies against Kled's published key | 943 of 943 Kled receipts |
| Fields rebuild the root | 991 of 1,000 |
| Anything that didn't match | 0 |

The nine receipts whose fields didn't rebuild the root are all unsigned Numo receipts from the Numo Mobile and Poseidon Season 1 clients. Their roots are on chain like every other receipt's. Those apps don't sign, so there's no way to tell from outside how they built the root. The page reports them as "can't check this yet" and doesn't treat them as changed.

Numo and oto receipts (57 in the sample) carry no provider signature, so check 2 doesn't apply to them.

Every receipt checked is listed in [`results/audit-20261028.json`](results/audit-20261028.json), with the summary in [`results/audit-20261028.md`](results/audit-20261028.md). To redraw the same sample:

```bash
npm run audit -- --n 1000 --seed 20261028 --lo 100000419 --hi 581807712
```

## Planned, not live

The DATA Network and Trace are moving to Sui, and Walrus becomes the default storage layer for DATA Foundation apps. Under the announced plan, Trace would keep an encrypted copy of each original on Walrus, with access controlled by Seal. A licensed buyer could then run check 4 against the stored original. The page shows this behind a "With Walrus on Sui (planned)" switch and never runs a check against it.

The current DATA Network keeps running until the upgrade, and holders don't need to do anything. Sources: [Sui announcement](https://www.sui.io/blog/data-network-joins-sui-walrus), [DATA on Sui docs](https://docs.datafdn.org/data-on-sui).

## Check one yourself

No dependencies, Node 20 or newer:

```bash
node scripts/verify-one.mjs d6fa7d84-afbe-5aeb-acd5-795ca63642ad
```

```
1 fields hash to root: true
2 signature verifies: true (https://www.kled.ai/.well-known/jwks.json)
3 in anchor tx: true (block 23901164, batch of 1)
```

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # verification tests against real receipts, including tampered copies
npm run audit -- --n 1000 --seed 20261028
```

The server only proxies public data, because Trace doesn't send CORS headers. Every hash and signature check runs in the browser. Responses are cached, and the featured receipt has a saved copy so the page still works if a source is slow.

## Layout

- `src/lib/checks.ts`: the four checks
- `src/lib/calldata.ts`: `registerBatch` decoding
- `src/lib/hash.ts`: canonical JSON and SHA-256
- `src/lib/sources.ts`: proxies for Trace, the explorer and published keys
- `src/components/`: the receipt, the check cards and the live log
- `scripts/audit.ts`: the random-sample audit
- `scripts/verify-one.mjs`: the standalone check
- `test/`: tests against saved real receipts

An independent project. Not made by or affiliated with the DATA Foundation, Sui or Walrus. MIT licensed.
