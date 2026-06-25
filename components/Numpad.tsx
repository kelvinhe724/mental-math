"use client";

interface NumpadProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  allowFraction?: boolean;
  allowDecimal?: boolean;
  allowNegative?: boolean;
}

export default function Numpad({ value, onChange, onSubmit, allowFraction, allowDecimal, allowNegative }: NumpadProps) {
  function press(key: string) {
    if (key === "DEL") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "CLR") {
      onChange("");
      return;
    }
    if (key === "/" && !allowFraction) return;
    if (key === "." && !allowDecimal) return;
    if (key === "−" && !allowNegative) return;
    // prevent duplicate separators
    if ((key === "/" || key === ".") && value.includes(key)) return;
    onChange(value + key);
  }

  const btnBase =
    "flex items-center justify-center rounded-2xl text-2xl font-semibold select-none active:scale-95 transition-transform cursor-pointer";
  const numBtn  = `${btnBase} bg-zinc-800 text-white h-16`;
  const actBtn  = `${btnBase} h-16`;

  const rows = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    allowFraction ? ["−", "0", "/"] : allowDecimal ? [".", "0", "−"] : ["", "0", ""],
  ];

  return (
    <div className="w-full max-w-xs mx-auto select-none">
      {/* display */}
      <div className="mb-3 rounded-2xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-right text-3xl font-mono text-white min-h-[56px]">
        {value || <span className="text-zinc-600">—</span>}
      </div>

      {/* digit grid */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        {rows.flat().map((k, i) =>
          k ? (
            <button key={i} className={numBtn} onClick={() => press(k)}>
              {k}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>

      {/* action row */}
      <div className="grid grid-cols-2 gap-2">
        <button className={`${actBtn} bg-zinc-700 text-white`} onClick={() => press("DEL")}>
          ⌫
        </button>
        <button
          className={`${actBtn} text-black font-bold ${value ? "bg-emerald-400" : "bg-zinc-600 text-zinc-400"}`}
          onClick={onSubmit}
          disabled={!value}
        >
          Enter
        </button>
      </div>

      {allowFraction && (
        <p className="text-center text-xs text-zinc-500 mt-2">Use / for fractions — e.g. 3/4</p>
      )}
    </div>
  );
}
