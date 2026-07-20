import React, { useState, useEffect, useMemo, useCallback } from "react";
import { apiRequest, unwrapResults } from "../../api/client.js";
import {
  findOpenLog,
  findOpenBreak,
  useElapsed,
  useBreakTimer,
} from "../../hooks/useTimeTracking.js";
import ActiveSessionBar from "./ActiveSessionBar.jsx";

export default function ActiveSessionContainer({ task, onRefreshTask }) {
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [breakType, setBreakType] = useState("lunch");
  const [sosSending, setSosSending] = useState(false);
  const [sosConfirmed, setSosConfirmed] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const todayStr = new Date().toLocaleDateString("en-CA");
      const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString(
        "en-CA"
      );
      const params = new URLSearchParams();
      params.set("date_from", weekAgo);
      params.set("date_to", todayStr);
      const res = await apiRequest(`/time/logs/?${params}`);
      setLogs(unwrapResults(res));
    } catch (e) {
      console.error("Failed to load time logs:", e);
    }
  }, []);

  useEffect(() => {
    if (task?.travel_status === "working") {
      loadLogs();
    }
  }, [task?.travel_status, loadLogs]);

  const openLog = useMemo(() => findOpenLog(logs), [logs]);
  const openBreak = useMemo(() => findOpenBreak(openLog), [openLog]);
  const elapsed = useElapsed(openLog?.clock_in);
  const breakElapsed = useBreakTimer(openBreak);

  const action = async (endpoint, body = {}) => {
    setBusy(true);
    try {
      await apiRequest(endpoint, {
        method: "POST",
        json: body,
      });
      await loadLogs();
      if (onRefreshTask) onRefreshTask();
    } catch (e) {
      alert(e?.body?.detail || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSOS = useCallback(async () => {
    if (sosSending || sosConfirmed) return;
    if (
      !window.confirm(
        "Send SOS alert? Your admin will be notified immediately with your location."
      )
    )
      return;
    setSosSending(true);
    try {
      const sendWithCoords = async (lat, lng) => {
        await apiRequest("/live-locations/sos/", {
          method: "POST",
          json: lat !== null ? { lat, lng } : {},
        });
        setSosConfirmed(true);
        setTimeout(() => setSosConfirmed(false), 8000);
      };

      navigator.geolocation?.getCurrentPosition(
        (pos) => sendWithCoords(pos.coords.latitude, pos.coords.longitude),
        () => sendWithCoords(null, null),
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } catch (err) {
      console.error("SOS failed:", err);
    } finally {
      setSosSending(false);
    }
  }, [sosSending, sosConfirmed]);

  if (!openLog) return null;

  return (
    <div className="mt-4">
      <ActiveSessionBar
        openLog={openLog}
        openBreak={openBreak}
        elapsed={elapsed}
        breakElapsed={breakElapsed}
        busy={busy}
        canModify={true}
        breakType={breakType}
        setBreakType={setBreakType}
        onStartBreak={() => action("/time/break/start/")}
        onEndBreak={() => action("/time/break/end/")}
        onClockOut={() => action("/time/clock-out/")}
        onSOS={handleSOS}
        sosSending={sosSending}
        sosConfirmed={sosConfirmed}
      />
    </div>
  );
}
