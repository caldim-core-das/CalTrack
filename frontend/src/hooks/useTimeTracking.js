import { useState, useEffect } from "react";

export function findOpenLog(logs) {
  return logs.find((l) => !l.clock_out) ?? null;
}

export function findOpenBreak(log) {
  if (!log?.breaks) return null;
  return log.breaks.find((b) => !b.break_end) ?? null;
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function useLiveClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function useElapsed(clockInStr) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!clockInStr) {
      setElapsed(0);
      return;
    }
    const start = new Date(clockInStr).getTime();
    const tick = () =>
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [clockInStr]);
  return elapsed;
}

export function useBreakTimer(openBreak) {
  const [breakElapsed, setBreakElapsed] = useState(0);
  useEffect(() => {
    if (!openBreak?.break_start) {
      setBreakElapsed(0);
      return;
    }
    const start = new Date(openBreak.break_start).getTime();
    const tick = () =>
      setBreakElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [openBreak?.break_start]);
  return breakElapsed;
}
