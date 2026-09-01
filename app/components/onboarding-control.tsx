"use client";

import { useOnboarding } from "../lib/use-onboarding";

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(value));
}

export function OnboardingControl({
  flash,
}: {
  flash: (message: string) => void;
}) {
  const onboarding = useOnboarding("operations");
  const state = onboarding.state;

  async function runRehearsal() {
    const result = await onboarding.runAction({
      action: "run_controlled_pilot_rehearsal",
    });
    if (result)
      flash(
        result.summary.latestRehearsalStatus === "passed"
          ? "Controlled onboarding rehearsal passed. Production and settlement remain locked."
          : "The rehearsal completed with blocked controls. Review the step evidence below.",
      );
  }

  if (onboarding.loading && !state)
    return (
      <div className="command-loading">
        <span className="pulse-dot" />
        <strong>Building the onboarding control record…</strong>
        <small>Cases · contracts · access · pilot gates</small>
      </div>
    );

  if (!state)
    return (
      <div className="command-error" role="alert">
        <strong>Onboarding controls unavailable</strong>
        <p>{onboarding.error || "The onboarding record could not be loaded."}</p>
        <button onClick={() => void onboarding.refresh()}>Try again</button>
      </div>
    );

  const latest = state.rehearsals[0] ?? null;
  const kpis = [
    {
      label: "Onboarding cases",
      value: `${state.summary.completedCases}/${state.summary.totalCases}`,
      detail: "Client · officer · Operations",
    },
    {
      label: "Required checks",
      value: `${state.summary.passedChecks}/${state.summary.requiredChecks}`,
      detail: "Evidence-linked synthetic checks",
    },
    {
      label: "Contract schemas",
      value: state.summary.preparedTemplates,
      detail: `${state.summary.signedDemoEnvelopes} signed demo envelopes`,
    },
    {
      label: "Workspace access",
      value: state.summary.activeDemoInvitations,
      detail: "Role-bound demo invitations",
    },
  ];

  return (
    <div className="onboarding-control">
      <section className="command-heading onboarding-heading">
        <div>
          <p className="eyebrow">Version 32 · controlled activation</p>
          <h1>Onboarding and pilot rehearsal</h1>
          <p>
            Prove the client, officer and Operations journey without issuing a
            live contract, enabling production access or releasing money.
          </p>
        </div>
        <div className="command-heading-actions">
          <button
            className="secondary-button"
            disabled={onboarding.busy}
            onClick={() => void onboarding.refresh()}
          >
            Refresh
          </button>
          <button
            className="primary-button primary-button--light"
            disabled={onboarding.busy}
            onClick={() => void runRehearsal()}
          >
            {onboarding.busy ? "Running controls…" : "Run end-to-end rehearsal"}
          </button>
        </div>
      </section>

      <section className="onboarding-lock-banner">
        <span aria-hidden="true">◆</span>
        <div>
          <strong>Production boundary enforced</strong>
          <p>
            Zero credit days. Cleared advance funding only. Payroll settlement,
            payslip issue and disbursement remain database-locked.
          </p>
        </div>
        <em>SIMULATION ONLY</em>
      </section>

      <section className="command-kpis onboarding-kpis" aria-label="Onboarding summary">
        {kpis.map((item) => (
          <article className="command-kpi command-kpi--neutral" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </section>

      {onboarding.error && (
        <div className="inline-notice" role="alert">
          {onboarding.error}
        </div>
      )}

      <section className="onboarding-grid">
        <article className="panel onboarding-cases-panel">
          <header className="command-panel-heading">
            <div>
              <p className="eyebrow">Three workspace identities</p>
              <h2>Onboarding cases</h2>
            </div>
            <span>{state.summary.completedCases} complete</span>
          </header>
          <div className="onboarding-case-list">
            {state.cases.map((item) => {
              const passed = item.checklist.filter(
                (check) => check.status === "verified_demo",
              ).length;
              return (
                <article key={item.id} className="onboarding-case-card">
                  <header>
                    <span className={`onboarding-subject onboarding-subject--${item.subjectType}`}>
                      {item.subjectType}
                    </span>
                    <em>{statusLabel(item.status)}</em>
                  </header>
                  <h3>{item.displayName}</h3>
                  <p>{item.contactEmail}</p>
                  <div className="onboarding-progress" aria-label={`${passed} of ${item.checklist.length} checks complete`}>
                    <span style={{ width: `${(passed / Math.max(item.checklist.length, 1)) * 100}%` }} />
                  </div>
                  <strong>{passed}/{item.checklist.length} checks verified</strong>
                  <ul>
                    {item.checklist.map((check) => (
                      <li key={check.id}>
                        <i>✓</i>
                        <span>{check.label}</span>
                        <small>{statusLabel(check.status)}</small>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </article>

        <aside className="panel onboarding-rehearsal-panel">
          <header className="command-panel-heading">
            <div>
              <p className="eyebrow">Latest evidence run</p>
              <h2>Controlled rehearsal</h2>
            </div>
            <span className={`onboarding-run-status onboarding-run-status--${latest?.status ?? "not_run"}`}>
              {latest ? latest.status : "not run"}
            </span>
          </header>
          {latest ? (
            <>
              <p className="onboarding-run-meta">
                {latest.flowVersion} · {dateTimeLabel(latest.createdAt)} SAST
              </p>
              <ol className="onboarding-step-list">
                {latest.steps.map((item) => (
                  <li key={item.code} className={`onboarding-step--${item.status}`}>
                    <i>{item.status === "passed" ? "✓" : "!"}</i>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="onboarding-empty-run">
              <span>◎</span>
              <strong>No rehearsal recorded yet</strong>
              <p>Run the end-to-end control path to create append-only evidence.</p>
            </div>
          )}
        </aside>
      </section>

      <section className="onboarding-grid onboarding-grid--lower">
        <article className="panel onboarding-contracts-panel">
          <header className="command-panel-heading">
            <div>
              <p className="eyebrow">Watermarked schemas only</p>
              <h2>Contract preparation</h2>
            </div>
            <span>{state.templates.length} versions</span>
          </header>
          <div className="onboarding-table" role="table" aria-label="Contract template preparation">
            <div className="onboarding-table-head" role="row">
              <span>Template</span><span>Variables</span><span>Envelope</span><span>Control</span>
            </div>
            {state.templates.map((template) => {
              const envelope = state.envelopes.find(
                (item) => item.templateCode === template.templateCode,
              );
              return (
                <div className="onboarding-table-row" role="row" key={template.id}>
                  <span><strong>{template.label}</strong><small>{template.templateVersion}</small></span>
                  <span><strong>{template.variables.length}</strong><small>explicit fields</small></span>
                  <span><strong>{envelope ? statusLabel(envelope.status) : "not generated"}</strong><small>{envelope?.signedAt ? dateTimeLabel(envelope.signedAt) : "—"}</small></span>
                  <span><strong>Watermarked</strong><small>{template.watermark}</small></span>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="panel onboarding-blockers-panel">
          <header className="command-panel-heading">
            <div>
              <p className="eyebrow eyebrow--amber">Fail-closed gates</p>
              <h2>Before production</h2>
            </div>
            <span>{state.productionBlockers.length} blockers</span>
          </header>
          <ol>
            {state.productionBlockers.map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </div>
  );
}
