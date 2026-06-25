"use client";
import { useEffect, useState } from "react";

interface TimerProps {
  totalSecs: number | null; // null = count up
  onExpire?: () => void;
  running: boolean;
}

export default function Timer({ totalSecs, onExpire, running }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (totalSecs && elapsed >= totalSecs) onExpire?.();
  }, [elapsed, totalSecs, onExpire]);

  const display = totalSecs ? Math.max(0, totalSecs - elapsed) : elapsed;
  const mins    = Math.floor(display / 60);
  const secs    = display % 60;
  const label   = `${mins}:${String(secs).padStart(2, "0")}`;

  const danger = totalSecs && display <= 30;

  return (
    <span className={`font-mono font-bold tabular-nums ${danger ? "text-red-400" : "text-zinc-300"}`}>
      {label}
    </span>
  );
}
