"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toPng } from "html-to-image";
import { dictionaries, fill, type Lang } from "@/lib/i18n";
import { loadActivity, loadBundle, runChecks, type Bundle } from "@/lib/client";
import { checkFile } from "@/lib/checks";
import type { CheckResult } from "@/lib/types";
import { CheckCard } from "./CheckCard";
import { FileDrop } from "./FileDrop";
import { LiveLog } from "./LiveLog";
import { ReceiptPaper } from "./ReceiptPaper";
import type { UiStatus } from "./StatusPill";

type Mode = "today" | "walrus";
const STEP_MS = 900;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SOURCES = [
  ["Sui announcement", "https://www.sui.io/blog/data-network-joins-sui-walrus"],
  ["DATA on Sui docs", "https://docs.datafdn.org/data-on-sui"],
  ["Trace", "https://trace.datafdn.org/about"],
  ["@datafdn post", "https://x.com/datafdn/status/2109468220273123382"],
] as const;

export function Checker({ initialId, initialLang, repoUrl }: { initialId: string; initialLang: Lang; repoUrl: string }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [mode, setMode] = useState<Mode>("today");
  const [dataId, setDataId] = useState(initialId);
  const [draft, setDraft] = useState("");
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<[UiStatus, UiStatus, UiStatus, UiStatus]>(["idle", "idle", "idle", "idle"]);
  const [results, setResults] = useState<(CheckResult | null)[]>([null, null, null, null]);
  const paperRef = useRef<HTMLDivElement>(null);
  const runId = useRef(0);
  const t = dictionaries[lang];

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const shareUrl = `${origin}/?id=${dataId}`;

  const check = useCallback(async (id: string) => {
    const run = ++runId.current;
    setLoading(true);
    setError("");
    setStatus(["idle", "idle", "idle", "idle"]);
    setResults([null, null, null, null]);
    const b = await loadBundle(id);
    if (run !== runId.current) return;
    setLoading(false);
    if (!b) {
      setBundle(null);
      setError(t.notFound);
      return;
    }
    setBundle(b);
    const outcomes = await runChecks(b);
    // Reveal one check at a time so each line on the receipt changes visibly.
    for (let i = 0; i < 3; i++) {
      if (run !== runId.current) return;
      setStatus((s) => s.map((v, j) => (j === i ? "running" : v)) as typeof s);
      await sleep(STEP_MS);
      if (run !== runId.current) return;
      setStatus((s) => s.map((v, j) => (j === i ? outcomes[i].status : v)) as typeof s);
      setResults((r) => r.map((v, j) => (j === i ? outcomes[i] : v)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Run after the effect returns so the reset inside check() isn't a synchronous render.
    void Promise.resolve().then(() => check(dataId));
    const url = new URL(window.location.href);
    url.searchParams.set("id", dataId);
    window.history.replaceState(null, "", url);
  }, [dataId, check]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (lang === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    window.history.replaceState(null, "", url);
    document.documentElement.lang = lang;
  }, [lang]);

  const pickLive = async () => {
    const events = await loadActivity(5);
    if (events[0]) setDataId(events[0].data_id);
  };

  const submitDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const id = draft.trim().toLowerCase().match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
    if (id) {
      setDataId(id);
      setDraft("");
    } else {
      setError(t.notFound);
    }
  };

  const onFile = async (buf: ArrayBuffer) => {
    if (!bundle) return;
    setStatus((s) => [s[0], s[1], s[2], "running"]);
    const r = await checkFile(bundle.receipt, buf);
    await sleep(400);
    setStatus((s) => [s[0], s[1], s[2], r.status]);
    setResults((x) => [x[0], x[1], x[2], r]);
  };

  const savePng = async () => {
    if (!paperRef.current) return;
    const url = await toPng(paperRef.current, { pixelRatio: 3, cacheBust: true });
    const a = document.createElement("a");
    a.href = url;
    a.download = `trace-receipt-${dataId.slice(0, 8)}.png`;
    a.click();
  };

  const app = bundle?.receipt.initial_metadata_json.app?.platform_name ?? bundle?.receipt.provider ?? "the app";
  const ev3 = results[2]?.evidence;
  const signed = Boolean(bundle?.receipt.initial_metadata_json.attestation);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[680px]">
          <div className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
            {t.eyebrow}
          </div>
          <h1 className="display mt-4 text-[42px] sm:text-[56px]">{t.title}</h1>
          <p className="mt-4 text-[17.5px] leading-normal tracking-[-0.011em] text-muted sm:text-[19px]">{t.lede}</p>
        </div>
        <div className="flex gap-0.5 rounded-full bg-tint p-1 text-sm font-medium" role="group" aria-label="Language">
          {(["en", "ko"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-full px-4 py-1.5 transition-colors ${lang === l ? "shadow-1x bg-surface text-ink" : "text-muted"}`}
              aria-pressed={lang === l}
            >
              {l === "en" ? "EN" : "한국어"}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={pickLive}
          className="btn h-12 rounded-full bg-ink px-6 text-[15px] font-semibold tracking-[-0.01em] text-bg"
        >
          {t.pickLive}
        </button>
        <form onSubmit={submitDraft} className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:max-w-md sm:flex-1">
          <label className="sr-only" htmlFor="data-id">
            {t.pasteLabel}
          </label>
          <input
            id="data-id"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.pasteLabel}
            className="shadow-1x h-12 min-w-0 flex-1 rounded-full bg-surface px-5 font-mono text-[13px] outline-none"
          />
          <button type="submit" className="btn ring-1x h-12 rounded-full bg-surface px-5 text-[15px] font-semibold">
            {t.check}
          </button>
        </form>
      </div>

      <p className="mt-4 text-[13.5px] text-muted">{t.trust}</p>

      {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      {bundle?.snapshot && <p className="mt-4 text-sm text-warn">{t.snapshot}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[436px_1fr]">
        <div className="stage-soft min-w-0 rounded-[28px] px-3 py-8 sm:px-6 lg:sticky lg:top-8 lg:self-start">
          {loading && !bundle ? (
            <div className="paper mx-auto flex h-[520px] max-w-[380px] items-center justify-center font-mono text-sm text-[#6e6e73]">
              {t.loading}
            </div>
          ) : (
            bundle && (
              <>
                <ReceiptPaper ref={paperRef} receipt={bundle.receipt} tx={bundle.tx} status={status} t={t} shareUrl={shareUrl} />
                <div className="mt-5 flex justify-center gap-4 text-sm font-medium">
                  <button type="button" onClick={savePng} className="text-ink underline-offset-4 hover:underline">
                    {t.print}
                  </button>
                  <a
                    href={`https://trace.datafdn.org/asset/${bundle.receipt.data_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted hover:underline"
                  >
                    trace.datafdn.org ↗
                  </a>
                </div>
              </>
            )
          )}
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <CheckCard
            n={1}
            question={t.q1.q}
            status={status[0]}
            proves={fill(
              results[0]?.evidence.note ? t.q1.notReproducible : signed ? t.q1.proves : t.q1.provesUnsigned,
              { app },
            )}
            doesnt={`${fill(t.q1.doesnt, { app })}${bundle?.receipt.provider === "kled" ? ` ${t.q1.termsNote}` : ""}`}
            evidence={results[0]?.evidence}
            t={t}
          />
          <CheckCard
            n={2}
            question={t.q2.q}
            status={status[1]}
            proves={signed ? fill(t.q2.proves, { app }) : fill(t.q2.unsigned, { app })}
            doesnt={signed ? t.q2.doesnt : ""}
            evidence={results[1]?.evidence}
            t={t}
          />
          <CheckCard
            n={3}
            question={t.q3.q}
            status={status[2]}
            proves={
              ev3?.block && ev3?.positionInBatch
                ? fill(t.q3.proves, { block: ev3.block, pos: ev3.positionInBatch })
                : t.q3.provesGeneric
            }
            doesnt={status[2] === "waiting" ? t.q3.waiting : t.q3.doesnt}
            evidence={
              ev3 && bundle?.receipt.tx_hash
                ? { ...ev3, explorer: `https://www.datanetscan.io/tx/${bundle.receipt.tx_hash}` }
                : ev3
            }
            t={t}
          />

          <section className="ring-1x min-w-0 rounded-[20px] bg-surface p-5">
            <div className="flex gap-0.5 rounded-full bg-tint p-1 text-sm font-medium" role="group">
              {(["today", "walrus"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-full px-3 py-2 transition-colors ${mode === m ? "shadow-1x bg-surface text-ink" : "text-muted"}`}
                  aria-pressed={mode === m}
                >
                  {m === "today" ? t.today : t.withWalrus}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {mode === "today" ? (
                <CheckCard
                  n={4}
                  question={t.q4.q}
                  status={status[3]}
                  proves={t.q4.proves}
                  doesnt={t.q4.doesnt}
                  evidence={results[3]?.evidence}
                  t={t}
                >
                  <p className="mt-3 text-sm leading-relaxed text-muted">{t.q4.todayBody}</p>
                  <FileDrop t={t} onFile={onFile} />
                </CheckCard>
              ) : (
                <div className="rounded-[20px] border border-dashed border-warn/40 bg-warn-soft/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-semibold leading-snug">
                      <span className="mr-2 font-mono text-muted">4</span>
                      {t.q4.q}
                    </h3>
                    <span className="shrink-0 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn">
                      {t.plannedBadge}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{t.q4.walrusBody}</p>
                  <a
                    href={SOURCES[0][1]}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-accent hover:underline"
                  >
                    {SOURCES[0][0]} ↗
                  </a>
                </div>
              )}
            </div>
          </section>

          <LiveLog t={t} onOpen={(id) => { setDataId(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      </div>

      <footer className="mt-20 border-t border-line pt-8 text-[13.5px] leading-relaxed text-muted">
        <p>{t.footer.holders}</p>
        <p className="mt-3">
          {t.footer.sources}:{" "}
          {SOURCES.map(([label, href], i) => (
            <span key={href}>
              {i > 0 && " · "}
              <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
                {label}
              </a>
            </span>
          ))}
          {" · "}
          <a href={repoUrl} target="_blank" rel="noreferrer" className="hover:underline">
            {t.footer.code}
          </a>
        </p>
        <p className="mt-3">{t.footer.unaffiliated}</p>
      </footer>
    </main>
  );
}
