"use client";
import { useEffect, useRef } from "react";

interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export default function Numpad({ value, onChange, onSubmit }: NumpadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (value === "") inputRef.current?.focus(); }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); onSubmit(); }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value.replace(/[^0-9./\-]/g, ""));
  }

  function pressKey(key: string) {
    const el = inputRef.current;
    if (!el) return;
    el.focus();

    if (key === "⌫") {
      const s  = el.selectionStart ?? value.length;
      const e2 = el.selectionEnd   ?? value.length;
      if (s !== e2) {
        onChange(value.slice(0, s) + value.slice(e2));
        requestAnimationFrame(() => el.setSelectionRange(s, s));
      } else if (s > 0) {
        onChange(value.slice(0, s - 1) + value.slice(s));
        requestAnimationFrame(() => el.setSelectionRange(s - 1, s - 1));
      }
      return;
    }
    if (key === "↵") { onSubmit(); return; }
    if (key === "←") {
      requestAnimationFrame(() => {
        const p = Math.max(0, (el.selectionStart ?? 0) - 1);
        el.setSelectionRange(p, p);
      });
      return;
    }
    if (key === "→") {
      requestAnimationFrame(() => {
        const p = Math.min(value.length, (el.selectionStart ?? value.length) + 1);
        el.setSelectionRange(p, p);
      });
      return;
    }

    const s  = el.selectionStart ?? value.length;
    const e2 = el.selectionEnd   ?? value.length;
    onChange(value.slice(0, s) + key + value.slice(e2));
    requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
  }

  const num = "flex items-center justify-center rounded-2xl text-2xl font-semibold select-none active:scale-95 transition-transform cursor-pointer h-14 bg-zinc-800 hover:bg-zinc-700 text-white";
  const sym = "flex items-center justify-center rounded-2xl text-xl font-medium select-none active:scale-95 transition-transform cursor-pointer h-14 bg-zinc-900 hover:bg-zinc-800 text-zinc-300";
  const nav = "flex items-center justify-center rounded-xl text-lg select-none active:scale-95 transition-transform cursor-pointer h-9 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-500";
  const ok  = `flex items-center justify-center rounded-2xl text-lg font-bold select-none active:scale-95 transition-transform cursor-pointer h-14 col-span-2 ${value ? "bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black" : "bg-zinc-800/40 text-zinc-600 cursor-not-allowed"}`;

  return (
    <div className="w-full max-w-xs mx-auto space-y-2">
      {/* Native input — arrow keys, cursor, physical keyboard all work */}
      <input
        ref={inputRef}
        type="text"
        inputMode="none"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="—"
        className="w-full rounded-2xl bg-zinc-900 border border-zinc-700/50 px-5 py-4
                   text-right text-3xl font-mono text-white placeholder-zinc-700
                   focus:outline-none focus:border-zinc-500 caret-emerald-400 mb-1"
      />

      {/* Cursor navigation row — compact arrows for mobile */}
      <div className="grid grid-cols-2 gap-2">
        <button className={nav} onPointerDown={e => { e.preventDefault(); pressKey("←"); }}>←</button>
        <button className={nav} onPointerDown={e => { e.preventDefault(); pressKey("→"); }}>→</button>
      </div>

      {/* Numpad grid: 4 columns */}
      <div className="grid grid-cols-4 gap-2">
        {(["7","8","9"] as const).map(k =>
          <button key={k} className={num} onPointerDown={e => { e.preventDefault(); pressKey(k); }}>{k}</button>
        )}
        <button className={sym} onPointerDown={e => { e.preventDefault(); pressKey("⌫"); }}>⌫</button>

        {(["4","5","6"] as const).map(k =>
          <button key={k} className={num} onPointerDown={e => { e.preventDefault(); pressKey(k); }}>{k}</button>
        )}
        <button className={sym} onPointerDown={e => { e.preventDefault(); pressKey("/"); }}>/</button>

        {(["1","2","3"] as const).map(k =>
          <button key={k} className={num} onPointerDown={e => { e.preventDefault(); pressKey(k); }}>{k}</button>
        )}
        <button className={sym} onPointerDown={e => { e.preventDefault(); pressKey("."); }}>.</button>

        <button className={sym} onPointerDown={e => { e.preventDefault(); pressKey("-"); }}>−</button>
        <button className={num} onPointerDown={e => { e.preventDefault(); pressKey("0"); }}>0</button>
        <button
          className={ok}
          onPointerDown={e => { e.preventDefault(); if (value) onSubmit(); }}
        >
          Enter ↵
        </button>
      </div>
    </div>
  );
}
