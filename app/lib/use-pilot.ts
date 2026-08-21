"use client";

import { useCallback, useEffect, useState } from "react";
import type { PilotAction, PilotState } from "./pilot-types";

type PilotResult = {
  state: PilotState | null;
  loading: boolean;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  runAction: (action: PilotAction) => Promise<PilotState | null>;
};

export function usePilot(): PilotResult {
  const [state, setState] = useState<PilotState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pilot", { cache: "no-store" });
      const payload = (await response.json()) as { state?: PilotState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "Unable to load the pilot workspace.");
      setState(payload.state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the pilot workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runAction = useCallback(async (action: PilotAction) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = (await response.json()) as { state?: PilotState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "The action could not be completed.");
      setState(payload.state);
      return payload.state;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, loading, busy, error, refresh, runAction };
}
