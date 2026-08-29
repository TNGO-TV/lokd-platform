"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformAction, PlatformState } from "./platform-types";

export function usePlatform() {
  const [state, setState] = useState<PlatformState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform", { cache: "no-store" });
      const payload = await response.json() as { state?: PlatformState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "Unable to load platform readiness.");
      setState(payload.state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load platform readiness.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The platform state is remote D1 state; loading it is the effect's synchronization work.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const runAction = useCallback(async (action: PlatformAction) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/platform", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = await response.json() as { state?: PlatformState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "The platform action could not be completed.");
      setState(payload.state);
      return payload.state;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The platform action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, loading, busy, error, refresh, runAction };
}
