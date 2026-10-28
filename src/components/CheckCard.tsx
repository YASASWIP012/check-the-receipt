"use client";

import { useState, type ReactNode } from "react";
import type { Dict } from "@/lib/i18n";
import { StatusPill, type UiStatus } from "./StatusPill";

interface Props {
  n: number;
  question: string;
  status: UiStatus;
  proves: string;
  doesnt: string;
  evidence?: Record<string, string>;
  t: Dict;
  children?: ReactNode;
}

export function CheckCard({ n, question, status, proves, doesnt, evidence, t, children }: Props) {
  const [open, setOpen] = useState(false);
  const settled = status !== "idle" && status !== "running";

  return (
    <section
      className={`relative min-w-0 overflow-hidden rounded-[20px] bg-surface p-5 transition-shadow sm:p-6 ${
        status === "running" ? "scanning" : ""
      } ${status === "pass" ? "shadow-[0_0_0_1.5px_rgba(31,122,61,0.45),var(--shadow-1)]" : "ring-1x"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">
          <span className="mr-2 font-mono text-muted">{n}</span>
          {question}
        </h3>
        <StatusPill status={status} t={t} />
      </div>

      {children}

      {settled && (
        <dl className="mt-4 grid gap-3 text-sm leading-relaxed">
          <div>
            <dt className="eyebrow">{t.proves}</dt>
            <dd className="mt-1">{proves}</dd>
          </div>
          {doesnt && (
            <div>
              <dt className="eyebrow">{t.doesnt}</dt>
              <dd className="mt-1 text-muted">{doesnt}</dd>
            </div>
          )}
        </dl>
      )}

      {settled && evidence && Object.keys(evidence).length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[13px] font-semibold text-ink underline-offset-4 hover:underline"
            aria-expanded={open}
          >
            {open ? t.hideBytes : t.showBytes}
          </button>
          {open && (
            <dl className="mt-3 grid gap-2 rounded-xl bg-bg p-3 font-mono text-[11px] leading-relaxed">
              {Object.entries(evidence)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid gap-0.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-all">
                      {/^https?:\/\//.test(v) ? (
                        <a href={v} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          {v}
                        </a>
                      ) : (
                        v
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
        </div>
      )}
    </section>
  );
}
