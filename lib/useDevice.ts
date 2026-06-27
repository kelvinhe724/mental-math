"use client";
import { useEffect, useState } from "react";

// pointer: coarse = touch device (phone/tablet); fine = mouse (desktop/laptop)
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(true); // default true (mobile-first SSR)
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isTouch;
}
