"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  OnboardingAction,
  OnboardingScope,
  OnboardingState,
} from "./onboarding-types";

export function useOnboarding(scope: OnboardingScope) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/onboarding?scope=${scope}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        state?: OnboardingState;
        error?: string;
      };
      if (!response.ok || !payload.state)
        throw new Error(
          payload.error ?? "The onboarding record could not be loaded.",
        );
      setState(payload.state);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The onboarding record could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    // This effect owns the remote onboarding-state lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const runAction = useCallback(
    async (action: OnboardingAction) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(`/api/onboarding?scope=${scope}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action),
        });
        const payload = (await response.json()) as {
          state?: OnboardingState;
          error?: string;
        };
        if (!response.ok || !payload.state)
          throw new Error(
            payload.error ?? "The onboarding action could not be completed.",
          );
        setState(payload.state);
        return payload.state;
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "The onboarding action could not be completed.",
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [scope],
  );

  return { state, loading, busy, error, refresh, runAction };
}
