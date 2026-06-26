"use client";
import { useEffect, useRef } from "react";

interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}

export default function Numpad({ value, onChange, onSubmit }: NumpadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the native input on mount so keyboard works immediately
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Re-focus after each question (value resets to "")
  useEffect(() => {
    if (value === "") inputRef.current?.focus();
  }, [value]);

  // Physical keyboard handler — digits, operators, backspace, enter
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
    // Let the browser handle arrow keys, backspace, selection natively
  }

  // Validate input: only allow digits, . / - in the field
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // strip anything that isn't a digit, dot, slash, or leading minus
    const cleaned = raw.replace(/[^0-9./\-]/g, "");
    onChange(cleaned);
  }

  // Numpad button press — inserts at cursor position in the native input
  function pressKey(key: string) {
    const el = inputRef.current;
    if (!el) return;
    el.focus();

    if (key === "⌫") {
      const start = el.selectionStart ?? value.length;
      const end   = el.selectionEnd   ?? value.length;
      if (start !== end) {
        // delete selection
        const next = value.slice(0, start) + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => el.setSelectionRange(start, start));
      } else if (start > 0) {
        const next = value.slice(0, start - 1) + value.slice(start);
        onChange(next);
        requestAnimationFrame(() => el.setSelectionRange(start - 1, start - 1));
      }
      return;
    }

    if (key === "↵") { onSubmit(); return; }

    // Insert at cursor
    const start = el.selectionStart ?? value.length;
    const end   = el.selectionEnd   ?? value.length;
    const next  = value.slice(0, start) + key + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.setSelectionRange(start + 1, start + 1));
  }

  const base = "flex items-center justify-center rounded-xl font-semibold text-xl select-none active:scale-95 transition-transform cursor-pointer h-14";
  const num  = `${base} bg-zinc-800 hover:bg-zinc-700 text-white`;
  const sym  = `${base} bg-zinc-700 hover:bg-zinc-600 text-zinc-200`;
  const del  = `${base} bg-zinc-700 hover:bg-zinc-600 text-zinc-200`;
  const ok   = `${base} font-bold text-black ${value ? "bg-emerald-400 hover:bg-emerald-300" : "bg-zinc-600 text-zinc-500 cursor-not-allowed"}`;

  // Layout:
  // Row 1: 7  8  9  ⌫
  // Row 2: 4  5  6  /
  // Row 3: 1  2  3  .
  // Row 4: -  0  [Enter ×2]
  const layout: { label: string; cls: string; key: string; span?: number }[][] = [
    [
      { label: "7", cls: num, key: "7" },
      { label: "8", cls: num, key: "8" },
      { label: "9", cls: num, key: "9" },
      { label: "⌫", cls: del, key: "⌫" },
    ],
    [
      { label: "4", cls: num, key: "4" },
      { label: "5", cls: num, key: "5" },
      { label: "6", cls: num, key: "6" },
      { label: "/", cls: sym, key: "/" },
    ],
    [
      { label: "1", cls: num, key: "1" },
      { label: "2", cls: num, key: "2" },
      { label: "3", cls: num, key: "3" },
      { label: ".", cls: sym, key: "." },
    ],
    [
      { label: "−", cls: sym, key: "-" },
      { label: "0", cls: num, key: "0" },
    ],
  ];

  return (
    <div className="w-full max-w-xs mx-auto">
      {/* Native input — supports arrow keys, cursor, keyboard typing */}
      <input
        ref={inputRef}
        type="text"
        inputMode="none"        // suppress mobile keyboard — we show our own pad
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="answer"
        className="w-full mb-3 rounded-2xl bg-zinc-900 border border-zinc-700 px-4 py-3
                   text-right text-3xl font-mono text-white placeholder-zinc-700
                   focus:outline-none focus:border-zinc-500 caret-emerald-400"
      />

      {/* Numpad grid */}
      <div className="space-y-2">
        {layout.map((row, ri) => (
          <div key={ri} className="grid gap-2" style={{ gridTemplateColumns: `repeat(4, 1fr)` }}>
            {row.map(({ label, cls, key }) => (
              <button
                key={key}
                className={cls}
                onPointerDown={e => { e.preventDefault(); pressKey(key); }}
              >
                {label}
              </button>
            ))}
            {/* last row: Enter spans remaining 2 columns */}
            {ri === layout.length - 1 && (
              <button
                className={`${ok} col-span-2`}
                onPointerDown={e => { e.preventDefault(); onSubmit(); }}
                disabled={!value}
              >
                Enter ↵
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-zinc-600 mt-2">
        Use / for fractions (e.g. 3/4) · − for negatives · arrow keys to move cursor
      </p>
    </div>
  );
}
