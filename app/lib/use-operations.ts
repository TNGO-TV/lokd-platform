"use client";

import { useCallback, useEffect, useState } from "react";
import type { OperationsAction, OperationsCommandState } from "./operations-types";

export function useOperations() {
  const [state, setState] = useState<OperationsCommandState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const payload = await response.json() as { state?: OperationsCommandState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "Operations could not be loaded.");
      setState(payload.state);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operations could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // This effect owns the remote command-state lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const runAction = useCallback(async (action: OperationsAction) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/operations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = await response.json() as { state?: OperationsCommandState; error?: string };
      if (!response.ok || !payload.state) throw new Error(payload.error ?? "The Operations action could not be completed.");
      setState(payload.state);
      return payload.state;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The Operations action could not be completed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, loading, busy, error, refresh, runAction };
}
