import type { Dict } from "@/lib/i18n";
import type { CheckStatus } from "@/lib/types";

export type UiStatus = CheckStatus | "idle" | "running";

const styles: Record<UiStatus, string> = {
  idle: "bg-tint text-muted",
  running: "bg-tint text-ink",
  pass: "bg-pass-soft text-pass",
  mismatch: "bg-bad-soft text-bad",
  waiting: "bg-warn-soft text-warn",
  unavailable: "bg-warn-soft text-warn",
};

const marks: Record<UiStatus, string> = {
  idle: "○",
  running: "◌",
  pass: "✓",
  mismatch: "✕",
  waiting: "…",
  unavailable: "–",
};

export function StatusPill({ status, t }: { status: UiStatus; t: Dict }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${styles[status]}`}
      aria-live="polite"
    >
      <span aria-hidden className={status === "running" ? "animate-spin inline-block" : ""}>
        {marks[status]}
      </span>
      {t.status[status]}
    </span>
  );
}

export function lineClass(status: UiStatus): string {
  switch (status) {
    case "pass":
      return "text-[#1f7a3d]";
    case "mismatch":
      return "text-[#b3261e] bg-[#fbe5e3]";
    case "waiting":
    case "unavailable":
      return "text-[#8f5200]";
    case "running":
      return "text-[#515154]";
    default:
      return "text-[#86868b]";
  }
}
