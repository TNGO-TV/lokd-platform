-- A configured, approved night rate must use the exact attendance that was
-- read during calculation. Retain the existing timesheet/version guards.
CREATE TRIGGER production_payroll_night_attendance_guard
BEFORE INSERT ON production_payroll_snapshots
WHEN EXISTS (
  SELECT 1 FROM payroll_policy_versions policy WHERE policy.id = NEW.policy_id
    AND json_extract(policy.rules_json, '$.wageRules.nightBasisPoints') > 10000
)
BEGIN
  SELECT (CASE WHEN EXISTS (
    SELECT 1 FROM json_each(NEW.payload_json, '$.items') item,
      json_each(item.value, '$.sources') source
    WHERE NOT EXISTS (
      SELECT 1 FROM shift_timesheets timesheet
      WHERE timesheet.id = json_extract(source.value, '$.id')
        AND timesheet.check_in_at IS json_extract(source.value, '$.check_in_at')
        AND timesheet.check_out_at IS json_extract(source.value, '$.check_out_at')
    )
  ) THEN RAISE(ABORT, 'Night-work attendance changed before payroll commit') END);
END;
