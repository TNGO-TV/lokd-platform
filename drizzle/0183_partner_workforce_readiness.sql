-- Reviewed partner engagements use confirmation of the partner's responsibility,
-- not the readiness status of LOKD's direct payroll. Preserve pending controls.
-- Suspended, held engagements retain immutable history; their independently
-- reviewed replacements must use partner_confirmed instead.
UPDATE workforce_engagements
SET payroll_status = CASE WHEN payroll_status = 'ready' THEN 'partner_confirmed' ELSE payroll_status END,
    benefits_status = CASE WHEN benefits_status = 'ready' THEN 'partner_confirmed' ELSE benefits_status END,
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE environment = 'production' AND model = 'partner'
  AND (payroll_status = 'ready' OR benefits_status = 'ready')
  AND NOT EXISTS (SELECT 1 FROM production_workforce_holds hold WHERE hold.engagement_id = workforce_engagements.id);
--> statement-breakpoint
CREATE TRIGGER production_partner_readiness_insert_guard
BEFORE INSERT ON workforce_engagements
WHEN NEW.environment = 'production' AND NEW.model = 'partner'
  AND (NEW.payroll_status = 'ready' OR NEW.benefits_status = 'ready')
BEGIN
  SELECT RAISE(ABORT, 'Partner payroll and benefits require partner_confirmed responsibility');
END;
--> statement-breakpoint
CREATE TRIGGER production_partner_readiness_update_guard
BEFORE UPDATE OF model, environment, payroll_status, benefits_status ON workforce_engagements
WHEN NEW.environment = 'production' AND NEW.model = 'partner'
  AND (NEW.payroll_status = 'ready' OR NEW.benefits_status = 'ready')
BEGIN
  SELECT RAISE(ABORT, 'Partner payroll and benefits require partner_confirmed responsibility');
END;
