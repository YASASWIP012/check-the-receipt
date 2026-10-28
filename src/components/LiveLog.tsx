"use client";

import { useEffect, useRef, useState } from "react";
import { fill, type Dict } from "@/lib/i18n";
import { loadActivity, loadBundle, runChecks } from "@/lib/client";
import type { CheckStatus } from "@/lib/types";

interface Row {
  dataId: string;
  app: string;
  at: string;
  outcome: CheckStatus | "running";
}

const POLL_MS = 15000;
const MAX_ROWS = 12;

// Overall outcome for a row: anything that doesn't match wins, then
// "waiting for anchor", then "can't check".
function summarise(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes("mismatch")) return "mismatch";
  if (statuses.every((s) => s === "pass")) return "pass";
  if (statuses.includes("waiting")) return "waiting";
  return "unavailable";
}

const dot: Record<Row["outcome"], string> = {
  running: "bg-accent animate-pulse",
  pass: "bg-pass",
  mismatch: "bg-bad",
  waiting: "bg-warn",
  unavailable: "bg-idle",
};

export function LiveLog({ t, onOpen }: { t: Dict; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const seen = useRef(new Set<string>());
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const events = (await loadActivity(8)).filter((e) => !seen.current.has(e.data_id)).slice(0, 4).reverse();
        for (const e of events) {
          if (!alive) break;
          seen.current.add(e.data_id);
          setRows((r) => [{ dataId: e.data_id, app: e.provider, at: e.at, outcome: "running" as const }, ...r].slice(0, MAX_ROWS));
          const bundle = await loadBundle(e.data_id);
          const outcome = bundle ? summarise((await runChecks(bundle)).map((c) => c.status)) : "unavailable";
          setRows((r) => r.map((row) => (row.dataId === e.data_id ? { ...row, outcome } : row)));
        }
      } finally {
        busy.current = false;
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const done = rows.filter((r) => r.outcome !== "running");
  const count = (o: CheckStatus) => done.filter((r) => r.outcome === o).length;

  return (
    <section className="ring-1x min-w-0 rounded-[20px] bg-surface p-5">
      <h2 className="text-[17px] font-semibold tracking-[-0.015em]">{t.live.title}</h2>
      <p className="mt-1 text-sm text-muted">{t.live.sub}</p>
      <p className="mt-3 text-xs text-muted">
        {fill(t.live.counts, { pass: count("pass"), waiting: count("waiting"), other: count("unavailable") + count("mismatch") })}
      </p>
      <ul className="mt-3 divide-y divide-line">
        {rows.map((r) => (
          <li key={r.dataId} className="flex items-center gap-3 py-2 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot[r.outcome]}`} aria-hidden />
            <span className="w-14 shrink-0 text-muted">{r.app}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{r.dataId}</span>
            <span className="hidden shrink-0 text-xs text-muted sm:inline">{r.at.slice(11, 19)}</span>
            <span className="w-24 shrink-0 text-right text-xs">
              {r.outcome === "running" ? t.status.running : t.status[r.outcome]}
            </span>
            <button
              type="button"
              onClick={() => onOpen(r.dataId)}
              className="shrink-0 text-xs font-medium text-accent hover:underline"
            >
              {t.live.open}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
