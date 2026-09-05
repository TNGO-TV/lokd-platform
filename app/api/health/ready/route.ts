import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};

type ReadinessChecks = { requiredTables: number; requiredTriggers: number; requiredViews: number; evidenceStoreBound: boolean };

function reply(status: "ready" | "unavailable", code: number, checks?: ReadinessChecks) {
  return Response.json(
    {
      status,
      service: "lokd-security",
      checkedAt: new Date().toISOString(),
      productionActivationAuthorized: false,
      payrollMode: "shadow_settlement_locked",
      onboardingMode: "controlled_demo_rehearsal",
      softwareIntegrationReady: status === "ready",
      remainingExternalProviders: ["iiDENTIFii", "payment processor"],
      checks: checks ?? null,
    },
    { status: code, headers },
  );
}

export async function GET() {
  if (!env.DB) return reply("unavailable", 503);
  try {
    const schema = await env.DB.prepare(`SELECT
      SUM(CASE WHEN type = 'table' AND name IN (
        'integration_provider_configs','api_idempotency_keys','integration_operations',
        'provider_webhook_inbox','domain_outbox_events','identity_verification_cases',
        'payment_orders','service_requests','document_artifacts','platform_readiness_controls',
        'scheduled_job_runs','operator_notifications','payroll_policy_versions',
        'officer_conversion_cases','operator_accounts','operator_role_assignments',
        'operator_action_policies','operator_approval_requests','payroll_shadow_validation_runs',
        'payroll_export_previews','payroll_exceptions','client_enquiries',
        'onboarding_cases','onboarding_checklist_items','contract_template_versions',
        'contract_envelopes','workspace_access_invitations','controlled_pilot_rehearsals',
        'specialist_commercial_reviews','specialist_partners','specialist_deployment_packs',
        'specialist_rehearsal_runs') THEN 1 ELSE 0 END) AS required_tables,
      SUM(CASE WHEN type = 'trigger' AND name IN (
        'officer_application_provenance_insert_v21','identity_case_transition_guard_v21',
        'payment_order_evidence_guard_v21','integration_operation_transition_guard_v21',
        'webhook_inbox_state_guard_v21','outbox_parent_provenance_v21',
        'officer_conversion_fee_insert_guard','officer_conversion_fee_update_guard',
        'officer_conversion_completion_guard','booking_zero_credit_insert_guard_v28',
        'booking_zero_credit_update_guard_v28','offer_advance_funding_insert_guard_v28',
        'offer_advance_funding_update_guard_v28','payroll_run_first_approval_guard_v28',
        'payroll_run_second_approval_guard_v28','payroll_policy_activation_guard_v28',
        'payroll_shadow_validation_insert_guard_v29','payroll_shadow_validation_update_guard_v29',
        'payroll_shadow_validation_delete_guard_v29','payroll_export_preview_insert_guard_v29',
        'payroll_export_preview_update_guard_v29','payroll_export_preview_delete_guard_v29',
        'payroll_exception_resolution_guard_v29','payroll_exception_delete_guard_v29',
        'payroll_settlement_lock_v29','payroll_settlement_insert_lock_v29',
        'payroll_disbursement_insert_lock_v29','payroll_disbursement_update_lock_v29',
        'payroll_disbursement_item_insert_lock_v29','payroll_disbursement_item_update_lock_v29',
        'payroll_payslip_insert_lock_v29','payroll_payslip_update_lock_v29',
        'client_enquiry_insert_guard_v30','client_enquiry_update_guard_v30',
        'client_enquiry_delete_guard_v30','onboarding_case_insert_guard_v32',
        'onboarding_case_update_guard_v32','onboarding_case_delete_guard_v32',
        'onboarding_check_insert_guard_v32','onboarding_check_update_guard_v32',
        'onboarding_check_delete_guard_v32','contract_template_insert_guard_v32',
        'contract_template_update_guard_v32','contract_template_delete_guard_v32',
        'contract_envelope_insert_guard_v32','contract_envelope_update_guard_v32',
        'contract_envelope_delete_guard_v32','workspace_access_insert_guard_v32',
        'workspace_access_update_guard_v32','workspace_access_delete_guard_v32',
        'controlled_pilot_rehearsal_insert_guard_v32',
        'controlled_pilot_rehearsal_update_guard_v32',
        'controlled_pilot_rehearsal_delete_guard_v32',
        'specialist_pricing_insert_guard_v33',
        'specialist_pricing_update_guard_v33',
        'specialist_pricing_version_immutable_v33',
        'specialist_booking_progress_guard_v33',
        'specialist_offer_insert_guard_v33',
        'specialist_offer_update_guard_v33',
        'specialist_activation_guard_v33',
        'specialist_activated_booking_immutable_v33',
        'specialist_commercial_reviews_insert_shape_v34',
        'specialist_commercial_reviews_update_shape_v34',
        'specialist_commercial_reviews_approval_v34',
        'specialist_commercial_reviews_history_v34',
        'specialist_partners_insert_shape_v34',
        'specialist_partners_update_shape_v34',
        'specialist_partners_approval_v34',
        'specialist_partners_history_v34',
        'specialist_deployment_packs_insert_shape_v34',
        'specialist_deployment_packs_update_shape_v34',
        'specialist_deployment_packs_approval_v34',
        'specialist_deployment_packs_history_v34',
        'specialist_rehearsal_demo_only_v34',
        'specialist_offer_pack_insert_v34',
        'specialist_offer_pack_update_v34',
        'specialist_activation_pack_v34',
        'specialist_revalidation_pack_v34',
        'specialist_pack_delete_epoch_v34') THEN 1 ELSE 0 END) AS required_triggers,
      SUM(CASE WHEN type = 'view' AND name IN (
        'specialist_pricing_validation_v33',
        'specialist_booking_control_validation_v33',
        'specialist_required_checks_v34',
        'specialist_pack_validation_v34') THEN 1 ELSE 0 END) AS required_views
      FROM sqlite_master`).first<{ required_tables: number; required_triggers: number; required_views: number }>();
    const checks = {
      requiredTables: Number(schema?.required_tables ?? 0),
      requiredTriggers: Number(schema?.required_triggers ?? 0),
      requiredViews: Number(schema?.required_views ?? 0),
      evidenceStoreBound: Boolean(env.BUCKET),
    };
    if (checks.requiredTables !== 32 || checks.requiredTriggers !== 79 || checks.requiredViews !== 4 || !checks.evidenceStoreBound) {
      return reply("unavailable", 503, checks);
    }
    return reply("ready", 200, checks);
  } catch {
    return reply("unavailable", 503);
  }
}
