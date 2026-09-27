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
            ? "This sample shows the client onboarding checks. Check the status of each rehearsal item below."
            : "This sample shows the officer onboarding checks. Check the status of each rehearsal item below."}
        </p>
        <span className="portal-onboarding-boundary">
          Simulation only · no live contract or production access
        </span>
      </div>
      {onboarding.error && <p role="alert">The latest refresh failed. These are the last loaded rehearsal results. <button onClick={() => void onboarding.refresh()}>Try again</button></p>}
      <div className="portal-onboarding-progress-card">
        <span><strong>{percent}%</strong><small>rehearsal complete</small></span>
        <div className="onboarding-progress" aria-label={`${passed} of ${onboardingCase.checklist.length} checks complete`}>
          <i style={{ width: `${percent}%` }} />
        </div>
        <ul>
          {onboardingCase.checklist.map((item) => (
            <li key={item.id}>
              <i aria-hidden="true">{item.status === "verified_demo" ? "✓" : "!"}</i>
              <span>{item.label}<small>{item.status === "verified_demo" ? "Complete in rehearsal" : `Not complete · ${item.status.replaceAll("_", " ")}`}</small></span>
            </li>
          ))}
        </ul>
      </div>
      <div className="journey-next agreement-readiness">
        <h3>Live agreement signing is not open</h3>
        <p>{scope === "client" ? "Before service starts, an authorised representative must sign the approved client terms and service order for the agreed booking." : "Before work starts, the appropriate approved employment or partner agreement must be complete, alongside the client agreements for that assignment."}</p>
        <p>Draft documents and completed demo checks do not count as signed agreements. Operations must confirm the approved documents, signer authority and current booking details. Changes can require a fresh review.</p>
        <p>{scope === "client" ? "The service plan and officer eligibility must also be confirmed before activation." : "Identity, current PSiRA registration matched to you, and the other assignment requirements must also be confirmed before activation. Training intake alone does not approve security work."}</p>
      </div>
    </section>
  );
}
