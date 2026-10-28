"use client";

import { useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";

export function FileDrop({ t, onFile }: { t: Dict; onFile: (buf: ArrayBuffer, name: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("");

  const take = async (f?: File | null) => {
    if (!f) return;
    setName(f.name);
    onFile(await f.arrayBuffer(), f.name);
  };

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
      className={`mt-3 w-full rounded-xl border border-dashed px-4 py-5 text-sm transition-colors ${
        over ? "border-accent bg-accent/5" : "border-line hover:border-muted"
      }`}
    >
      <span className="text-muted">{name || t.q4.drop}</span>
      <input ref={input} type="file" className="hidden" onChange={(e) => take(e.target.files?.[0])} />
    </button>
  );
}
