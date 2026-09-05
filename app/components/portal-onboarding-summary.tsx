"use client";

import type { OnboardingScope } from "../lib/onboarding-types";
import { useOnboarding } from "../lib/use-onboarding";

export function PortalOnboardingSummary({
  scope,
}: {
  scope: Exclude<OnboardingScope, "operations">;
}) {
  const onboarding = useOnboarding(scope);
  const onboardingCase = onboarding.state?.cases[0] ?? null;

  if (onboarding.loading && !onboardingCase)
    return (
      <section className="portal-onboarding-card portal-onboarding-card--loading">
        <span className="pulse-dot" />
        <strong>Checking your synthetic onboarding record…</strong>
      </section>
    );

  if (!onboardingCase)
    return (
      <section className="portal-onboarding-card portal-onboarding-card--error" role="alert">
        <strong>Onboarding record unavailable</strong>
        <p>{onboarding.error || "The record could not be loaded."}</p>
        <button onClick={() => void onboarding.refresh()}>Try again</button>
      </section>
    );

  const passed = onboardingCase.checklist.filter(
    (item) => item.status === "verified_demo",
  ).length;
  const percent = Math.round(
    (passed / Math.max(onboardingCase.checklist.length, 1)) * 100,
  );

  return (
    <section className={`portal-onboarding-card portal-onboarding-card--${scope}`}>
      <div className="portal-onboarding-copy">
        <p className="eyebrow">Synthetic onboarding rehearsal</p>
        <h2>{scope === "client" ? "Organisation readiness" : "Officer readiness"}</h2>
        <p>
          {scope === "client"
            ? "Your demo entity, agreement variables, advance-funding instruction and workspace access are prepared."
            : "Your demo identity, PSiRA, payroll destination, agreement variables and workspace access are prepared."}
        </p>
        <span className="portal-onboarding-boundary">
          Simulation only · no live contract or production access
        </span>
      </div>
      <div className="portal-onboarding-progress-card">
        <span><strong>{percent}%</strong><small>rehearsal complete</small></span>
        <div className="onboarding-progress" aria-label={`${passed} of ${onboardingCase.checklist.length} checks complete`}>
          <i style={{ width: `${percent}%` }} />
        </div>
        <ul>
          {onboardingCase.checklist.map((item) => (
            <li key={item.id}>
              <i>✓</i>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
