"use client";

import { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import { fill, type Dict } from "@/lib/i18n";
import type { AnchorTx, TraceReceipt } from "@/lib/types";
import { decodeRegisterBatch, uuidToHex } from "@/lib/calldata";
import { lineClass, type UiStatus } from "./StatusPill";

interface Props {
  receipt: TraceReceipt;
  tx: AnchorTx | null;
  status: [UiStatus, UiStatus, UiStatus, UiStatus];
  t: Dict;
  shareUrl: string;
}

const short = (h?: string, n = 8) => {
  const s = (h ?? "").replace(/^sha256:/, "");
  return s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-4)}` : s;
};

const formatBytes = (b?: number) => {
  if (!b) return "–";
  // 1024-based, matching how Trace displays sizes.
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
};

const day = (iso?: string) => (iso ? iso.slice(0, 10) : "–");
const time = (iso?: string) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC` : "–");

function Row({ label, value, state, mono }: { label: string; value: string; state: UiStatus; mono?: boolean }) {
  return (
    <div className={`line-state flex justify-between gap-4 px-1 py-[3px] ${lineClass(state)}`}>
      <span className="shrink-0">{label}</span>
      <span className={`text-right truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export const ReceiptPaper = forwardRef<HTMLDivElement, Props>(function ReceiptPaper(
  { receipt, tx, status, t, shareUrl },
  ref,
) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    QRCode.toDataURL(shareUrl, { margin: 0, width: 160, color: { dark: "#1c1b19", light: "#00000000" } }).then(setQr);
  }, [shareUrl]);

  const m = receipt.initial_metadata_json;
  const app = m.app?.platform_name ?? receipt.provider;
  const c = m.contributor;
  const [s1, s2, s3, s4] = status;
  const version = (v?: string) => (v ? fill(t.lines.accepted, { v }) : "–");

  let position = "";
  if (tx?.rawInput) {
    try {
      const recs = decodeRegisterBatch(tx.rawInput);
      const i = recs.findIndex((r) => r.dataId === uuidToHex(receipt.data_id));
      if (i >= 0) position = ` · ${i + 1}/${recs.length}`;
    } catch {
      // position is decoration only
    }
  }

  return (
    <div ref={ref} className="paper relative mx-auto w-full max-w-[380px] px-5 pt-8 pb-9 font-mono text-[12.5px] leading-snug">
      <div className="text-center">
        <div className="text-[15px] font-semibold tracking-[0.3em]">TRACE</div>
        <div className="mt-1 text-[11px] tracking-widest text-[#6b6760]">{t.lines.receipt} · {fill(t.lines.via, { app })}</div>
        <div className="mt-2 text-[11px] text-[#6b6760] break-all">{receipt.data_id}</div>
      </div>

      <div className="my-4 border-t border-dashed border-[#c9c4b8]" />

      <Row label={t.lines.media} value={`${m.file?.media_category ?? "–"} · ${m.file?.mime_type ?? ""}`} state={s1} />
      <Row label={t.lines.size} value={formatBytes(m.file?.size_bytes)} state={s1} />
      <Row label={t.lines.captured} value={`${day(m.timestamps?.captured_at)} · ${m.file?.behavior?.captured_via?.replace(/_/g, " ") ?? ""}`} state={s1} />
      <Row label={t.lines.contributor} value={fill(t.lines.kyc, { status: c?.kyc_status ?? "–", country: c?.kyc_country ?? "–" })} state={s1} />
      <Row label={t.lines.tos} value={version(c?.consent?.tos_version)} state={s1} />
      <Row label={t.lines.pp} value={version(c?.consent?.privacy_policy_version)} state={s1} />

      <div className="my-3 border-t border-dashed border-[#c9c4b8]" />

      <Row label={t.lines.signedBy} value={`${app} · ${time(m.attestation?.signed_at_utc)}`} state={s2} />
      <Row label={t.lines.fingerprint} value={short(m.file?.content_sha256)} state={s4 === "pass" ? "pass" : s3} mono />
      <Row
        label={t.lines.anchored}
        value={receipt.tx_hash ? `${fill(t.lines.block, { block: tx?.blockNumber ?? "…" })}${position}` : t.lines.pending}
        state={s3}
      />

      <div className="my-4 border-t border-dashed border-[#c9c4b8]" />

      <div className="flex items-end justify-between gap-4">
        <div className="text-[11px] text-[#6b6760] leading-relaxed">
          <div>root {short(receipt.initial_metadata_root, 6)}</div>
          <div>tx {short(receipt.tx_hash ?? "", 6) || "–"}</div>
          <div className="mt-2 tracking-wide">trace.datafdn.org</div>
        </div>
        {/* A local data: URL, so next/image has nothing to optimise. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="" width={72} height={72} className="opacity-90" />}
      </div>
    </div>
  );
});
