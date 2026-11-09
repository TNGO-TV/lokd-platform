-- Internal pay basis and auditable policy warnings. No employment titles or automatic conversion.
DROP TRIGGER id04_workforce_frozen;
--> statement-breakpoint
DROP TRIGGER signed_workforce_terms_update_guard;
--> statement-breakpoint
DROP TRIGGER legacy_workforce_snapshots_no_update;
--> statement-breakpoint
ALTER TABLE workforce_engagements ADD COLUMN pay_basis TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_basis IN ('hourly','monthly'));
--> statement-breakpoint
ALTER TABLE assignment_workforce_snapshots ADD COLUMN pay_basis TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_basis IN ('hourly','monthly'));
--> statement-breakpoint
ALTER TABLE workforce_engagements ADD COLUMN agreed_hourly_rate_cents INTEGER CHECK(agreed_hourly_rate_cents IS NULL OR agreed_hourly_rate_cents>=0);
--> statement-breakpoint
ALTER TABLE assignment_workforce_snapshots ADD COLUMN agreed_hourly_rate_cents INTEGER CHECK(agreed_hourly_rate_cents IS NULL OR agreed_hourly_rate_cents>=0);
--> statement-breakpoint
ALTER TABLE workforce_engagements ADD COLUMN pay_cadence TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_cadence IN ('daily','weekly','monthly'));
--> statement-breakpoint
ALTER TABLE assignment_workforce_snapshots ADD COLUMN pay_cadence TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_cadence IN ('daily','weekly','monthly'));
--> statement-breakpoint
ALTER TABLE workforce_engagements ADD COLUMN pay_cadence_request_reference TEXT;
--> statement-breakpoint
ALTER TABLE assignment_workforce_snapshots ADD COLUMN pay_cadence_request_reference TEXT;
--> statement-breakpoint
UPDATE workforce_engagements SET pay_basis='hourly',pay_cadence='weekly' WHERE model='direct_flex';
--> statement-breakpoint
UPDATE assignment_workforce_snapshots SET pay_basis='hourly',pay_cadence='weekly' WHERE workforce_model='direct_flex';
--> statement-breakpoint
ALTER TABLE workforce_terms_acceptances ADD COLUMN agreement_type TEXT NOT NULL DEFAULT 'monthly' CHECK(agreement_type IN ('hourly','monthly'));
--> statement-breakpoint
UPDATE workforce_terms_acceptances SET agreement_type=COALESCE((SELECT pay_basis FROM workforce_engagements w WHERE w.id=workforce_engagement_id),'monthly');
--> statement-breakpoint
CREATE TRIGGER id04_workforce_frozen BEFORE UPDATE ON workforce_engagements WHEN EXISTS(SELECT 1 FROM production_workforce_holds WHERE engagement_id=OLD.id) BEGIN SELECT RAISE(ABORT,'Suspended workforce history cannot be reactivated or rewritten'); END;
--> statement-breakpoint
CREATE TRIGGER signed_workforce_terms_update_guard BEFORE UPDATE ON workforce_terms_acceptances
WHEN OLD.id LIKE 'WTA-LIVE-%' BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.workforce_engagement_id IS NOT OLD.workforce_engagement_id
 OR NEW.officer_id IS NOT OLD.officer_id OR NEW.terms_version IS NOT OLD.terms_version
 OR NEW.acceptance_mode IS NOT OLD.acceptance_mode OR NEW.environment IS NOT OLD.environment
 OR NEW.integrity_state IS NOT OLD.integrity_state OR NEW.evidence_reference IS NOT OLD.evidence_reference
 OR NEW.accepted_at IS NOT OLD.accepted_at OR NEW.expires_at IS NOT OLD.expires_at
 OR NEW.created_at IS NOT OLD.created_at OR NEW.version IS NOT OLD.version
 OR NEW.active_key IS NOT NULL THEN RAISE(ABORT,'Signed workforce terms are immutable except withdrawal') END);
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_workforce_snapshots_no_update`
BEFORE UPDATE ON `assignment_workforce_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'assignment_workforce_snapshots_immutable');
END;
--> statement-breakpoint
ALTER TABLE offers ADD COLUMN roster_slot_id TEXT REFERENCES roster_slots(id);
--> statement-breakpoint
ALTER TABLE payroll_runs ADD COLUMN pay_basis TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_basis IN ('hourly','monthly'));
--> statement-breakpoint
ALTER TABLE payroll_runs ADD COLUMN pay_cadence TEXT NOT NULL DEFAULT 'monthly' CHECK(pay_cadence IN ('daily','weekly','monthly'));
--> statement-breakpoint
CREATE TABLE workforce_policy_warnings(id TEXT PRIMARY KEY NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,officer_id TEXT REFERENCES officers(id),code TEXT NOT NULL,detail TEXT NOT NULL,context_json TEXT NOT NULL CHECK(json_valid(context_json)),observed_by TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX workforce_policy_warnings_entity ON workforce_policy_warnings(entity_type,entity_id,created_at);
--> statement-breakpoint
CREATE TABLE workforce_policy_overrides(warning_id TEXT PRIMARY KEY NOT NULL REFERENCES workforce_policy_warnings(id),actor_id TEXT NOT NULL,reason TEXT NOT NULL CHECK(length(trim(reason))>=3),created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER workforce_policy_warnings_no_update BEFORE UPDATE ON workforce_policy_warnings BEGIN SELECT RAISE(ABORT,'Policy warning and override history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER workforce_policy_warnings_no_delete BEFORE DELETE ON workforce_policy_warnings BEGIN SELECT RAISE(ABORT,'Policy warning and override history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER workforce_policy_overrides_no_update BEFORE UPDATE ON workforce_policy_overrides BEGIN SELECT RAISE(ABORT,'Policy warning and override history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER workforce_policy_overrides_no_delete BEFORE DELETE ON workforce_policy_overrides BEGIN SELECT RAISE(ABORT,'Policy warning and override history is immutable'); END;
--> statement-breakpoint
CREATE TABLE workforce_pay_policy_defaults(singleton INTEGER PRIMARY KEY CHECK(singleton=1),rules_json TEXT NOT NULL CHECK(json_valid(rules_json)));
--> statement-breakpoint
INSERT INTO workforce_pay_policy_defaults VALUES(1,'{"hourlyPay":{"premiumBasisPoints":1500,"minimumShiftMinutes":240,"sundayPublicHolidayBasisPoints":20000,"hourlyDivisor":208,"weeklyHourThreshold":24}}');
--> statement-breakpoint
CREATE VIEW current_hourly_pay_rules AS WITH current AS (SELECT id,rules_json,status FROM payroll_policy_versions WHERE environment='production' AND integrity_state='production_verified' AND status!='withdrawn' ORDER BY created_at DESC,rowid DESC LIMIT 1)
 SELECT current.id AS policy_id,current.status AS approval_status,
 COALESCE(json_extract(current.rules_json,'$.hourlyPay.weeklyHourThreshold'),json_extract(d.rules_json,'$.hourlyPay.weeklyHourThreshold'))*60 AS cap_minutes,
 COALESCE(current.rules_json,d.rules_json) AS rules_json FROM workforce_pay_policy_defaults d LEFT JOIN current ON 1=1;
--> statement-breakpoint
CREATE TRIGGER workforce_agreement_type_immutable BEFORE UPDATE OF agreement_type ON workforce_terms_acceptances WHEN NEW.agreement_type IS NOT OLD.agreement_type BEGIN SELECT RAISE(ABORT,'Accepted agreement classification is immutable'); END;
--> statement-breakpoint
CREATE VIEW employment_offer_slots AS SELECT f.id AS offer_id,f.officer_id,f.booking_id,f.status,
 COALESCE(f.roster_slot_id,(SELECT min(r.id) FROM roster_slots r WHERE r.booking_id=f.booking_id AND r.status!='cancelled' HAVING count(*)=1)) AS slot_id FROM offers f;
--> statement-breakpoint
CREATE VIEW employment_work_intervals AS
 SELECT ra.officer_id,rs.id AS slot_id,'assignment:'||ra.id AS source_id,
 COALESCE(s.check_in_at,rs.starts_at) AS starts_at,COALESCE(s.check_out_at,rs.ends_at) AS ends_at
 FROM roster_assignments ra JOIN roster_slots rs ON rs.id=ra.roster_slot_id LEFT JOIN shifts s ON s.id=ra.shift_id
 WHERE ra.environment='production' AND (ra.status NOT IN ('cancelled','replaced','released') OR s.check_in_at IS NOT NULL)
 UNION ALL SELECT rd.replacement_officer_id,rs.id,'relief:'||rd.id,rs.starts_at,rs.ends_at FROM relief_dispatches rd JOIN roster_slots rs ON rs.id=rd.roster_slot_id WHERE rd.environment='production' AND rd.status NOT IN ('cancelled','replaced') AND NOT EXISTS(SELECT 1 FROM roster_assignments a WHERE a.officer_id=rd.replacement_officer_id AND a.roster_slot_id=rs.id AND a.status NOT IN ('cancelled','replaced','released'))
 UNION ALL SELECT f.officer_id,r.id,'offer:'||f.offer_id,r.starts_at,r.ends_at FROM employment_offer_slots f JOIN roster_slots r ON r.id=f.slot_id WHERE f.status='accepted' AND r.status!='cancelled' AND NOT EXISTS(SELECT 1 FROM roster_assignments a WHERE a.officer_id=f.officer_id AND a.roster_slot_id=r.id)
 UNION ALL SELECT officer_id,NULL,'external:'||id,starts_at,ends_at FROM officer_work_commitments WHERE environment='production' AND status!='cancelled';
--> statement-breakpoint
CREATE VIEW hourly_shift_hour_checks AS WITH RECURSIVE weeks(slot_id,week_start) AS (
 SELECT id,date(starts_at,'+2 hours',printf('-%d days',(CAST(strftime('%w',starts_at,'+2 hours') AS INTEGER)+6)%7)) FROM roster_slots
 UNION ALL SELECT w.slot_id,date(w.week_start,'+7 days') FROM weeks w JOIN roster_slots r ON r.id=w.slot_id WHERE julianday(date(w.week_start,'+7 days')||'T00:00:00+02:00')<julianday(r.ends_at)
 ) SELECT w.officer_id,r.id AS slot_id,k.week_start,p.cap_minutes,
 CAST(ROUND((min(julianday(r.ends_at),julianday(date(k.week_start,'+7 days')||'T00:00:00+02:00'))-max(julianday(r.starts_at),julianday(k.week_start||'T00:00:00+02:00')))*1440) AS INTEGER)
 +COALESCE((SELECT sum(CAST(ROUND((min(julianday(i.ends_at),julianday(date(k.week_start,'+7 days')||'T00:00:00+02:00'))-max(julianday(i.starts_at),julianday(k.week_start||'T00:00:00+02:00')))*1440) AS INTEGER)) FROM employment_work_intervals i WHERE i.officer_id=w.officer_id AND i.slot_id IS NOT r.id AND julianday(i.starts_at)<julianday(date(k.week_start,'+7 days')||'T00:00:00+02:00') AND julianday(i.ends_at)>julianday(k.week_start||'T00:00:00+02:00')),0) AS projected_minutes
 FROM weeks k JOIN roster_slots r ON r.id=k.slot_id JOIN workforce_engagements w ON w.pay_basis='hourly' AND w.environment='production' AND w.status='active' AND w.active_key=w.officer_id LEFT JOIN current_hourly_pay_rules p ON 1=1;
--> statement-breakpoint
CREATE TRIGGER workforce_pay_basis_change_audit AFTER UPDATE OF pay_basis,agreed_hourly_rate_cents,pay_cadence,pay_cadence_request_reference ON workforce_engagements WHEN NEW.pay_basis IS NOT OLD.pay_basis OR NEW.agreed_hourly_rate_cents IS NOT OLD.agreed_hourly_rate_cents OR NEW.pay_cadence IS NOT OLD.pay_cadence OR NEW.pay_cadence_request_reference IS NOT OLD.pay_cadence_request_reference BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) VALUES(lower(hex(randomblob(16))),'operations','system:pay-basis-edit','officer_pay_basis_changed','workforce_engagement',NEW.id,json_object('previousPayBasis',OLD.pay_basis,'payBasis',NEW.pay_basis,'previousRateCents',OLD.agreed_hourly_rate_cents,'rateCents',NEW.agreed_hourly_rate_cents,'payCadence',NEW.pay_cadence),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
 INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'workforce_engagement',NEW.id,NEW.officer_id,'PAY_CADENCE_REQUEST_REVIEW','Review the officer request for daily or monthly pay',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NEW.pay_basis='hourly' AND NEW.pay_cadence!='weekly' AND length(trim(COALESCE(NEW.pay_cadence_request_reference,'')))<3;
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;
--> statement-breakpoint
DROP TRIGGER assignment_booking_workforce_route_guard;
--> statement-breakpoint
CREATE TRIGGER assignment_booking_workforce_route_guard BEFORE INSERT ON assignment_workforce_snapshots WHEN NEW.environment='production' BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'assignment_workforce_snapshots',NEW.id,NEW.officer_id,'HOURLY_FIXED_REVIEW','Review hourly pay for an Officer assigned to a LOKD Fixed roster',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE EXISTS(SELECT 1 FROM roster_assignments a JOIN roster_slots r ON r.id=a.roster_slot_id JOIN bookings b ON b.id=r.booking_id JOIN workforce_engagements w ON w.id=NEW.workforce_engagement_id WHERE a.id=NEW.roster_assignment_id AND b.engagement_model='fixed' AND w.pay_basis='hourly');
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;
--> statement-breakpoint
DROP TRIGGER activation_booking_workforce_route_guard;
--> statement-breakpoint
CREATE TRIGGER activation_booking_workforce_route_guard BEFORE INSERT ON assignment_activation_snapshots WHEN NEW.environment='production' BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'assignment_activation_snapshots',NEW.id,NEW.officer_id,'HOURLY_FIXED_REVIEW','Review hourly pay for an Officer assigned to a LOKD Fixed roster',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE EXISTS(SELECT 1 FROM bookings b JOIN workforce_engagements w ON w.id=NEW.workforce_engagement_id WHERE b.id=NEW.booking_id AND b.engagement_model='fixed' AND w.pay_basis='hourly');
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;SELECT CASE WHEN json_extract(NEW.site_evidence,'$.bookingModel') IS NOT (SELECT engagement_model FROM bookings WHERE id=NEW.booking_id) THEN RAISE(ABORT,'Booking model snapshot does not match its source record') END; END;
--> statement-breakpoint
DROP TRIGGER `hour_reservation_total_week_cap_v4`;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_total_week_cap_v4`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`environment` = nwe.`environment`
			AND ra.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
			AND ra.`status` NOT IN ('cancelled','replaced','released')
			AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`environment` = nwe.`environment`
			AND rd.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
			AND rd.`status` NOT IN ('cancelled','replaced')
			AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
			AND (julianday(rs.`starts_at`) IS NULL OR julianday(rs.`ends_at`) IS NULL
				OR julianday(rs.`ends_at`) <= julianday(rs.`starts_at`)
				OR strftime('%S',rs.`starts_at`) <> '00' OR strftime('%S',rs.`ends_at`) <> '00')
		UNION ALL
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
		WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`environment` = nwe.`environment`
			AND owc.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'verified' ELSE 'synthetic' END
			AND owc.`status` <> 'cancelled'
			AND (julianday(owc.`starts_at`) IS NULL OR julianday(owc.`ends_at`) IS NULL
				OR julianday(owc.`ends_at`) <= julianday(owc.`starts_at`)
				OR strftime('%S',owc.`starts_at`) <> '00' OR strftime('%S',owc.`ends_at`) <> '00')
	) THEN RAISE(ABORT, 'existing_work_interval_invalid') END);
	INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'workforce_hour_reservations',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review weekly hours across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (NEW.`reserved_minutes` + COALESCE((
		SELECT SUM(`work_minutes`) FROM (
			SELECT r.`reserved_minutes` AS `work_minutes`
			FROM `workforce_hour_reservations` r
			JOIN `workforce_engagements` rwe ON rwe.`id` = r.`workforce_engagement_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE r.`officer_id` = NEW.`officer_id` AND r.`iso_week_start` = NEW.`iso_week_start`
				AND r.`status` = 'active' AND rwe.`environment` = nwe.`environment`
				AND NOT (r.`source_type` = NEW.`source_type` AND r.`source_id` = NEW.`source_id`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `roster_assignments` ra JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE ra.`officer_id` = NEW.`officer_id` AND ra.`environment` = nwe.`environment`
				AND ra.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
				AND ra.`status` NOT IN ('cancelled','replaced','released')
				AND NOT (NEW.`source_type` = 'assignment' AND ra.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'assignment' AND covered.`source_id` = ra.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(rs.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(rs.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `relief_dispatches` rd JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE rd.`replacement_officer_id` = NEW.`officer_id` AND rd.`environment` = nwe.`environment`
				AND rd.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'production_verified' ELSE 'synthetic' END
				AND rd.`status` NOT IN ('cancelled','replaced')
				AND NOT (NEW.`source_type` = 'relief' AND rd.`id` = NEW.`source_id`)
				AND julianday(rs.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(rs.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
				AND NOT EXISTS (SELECT 1 FROM `workforce_hour_reservations` covered
					WHERE covered.`officer_id` = NEW.`officer_id` AND covered.`status` = 'active'
						AND covered.`source_type` = 'relief' AND covered.`source_id` = rd.`id`
						AND covered.`iso_week_start` = NEW.`iso_week_start`)
			UNION ALL
			SELECT CAST(ROUND((MIN(julianday(owc.`ends_at`),julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))-
				MAX(julianday(owc.`starts_at`),julianday(NEW.`iso_week_start`||'T00:00:00+02:00')))*1440) AS INTEGER)
			FROM `officer_work_commitments` owc
			JOIN `workforce_engagements` nwe ON nwe.`id` = NEW.`workforce_engagement_id`
			WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`environment` = nwe.`environment`
				AND owc.`integrity_state` = CASE nwe.`environment` WHEN 'production' THEN 'verified' ELSE 'synthetic' END
				AND owc.`status` <> 'cancelled'
				AND julianday(owc.`starts_at`) < julianday(date(NEW.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
				AND julianday(owc.`ends_at`) > julianday(NEW.`iso_week_start`||'T00:00:00+02:00')
		) `weekly_work`
	),0) > NEW.`weekly_cap_minutes`) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;
END;
--> statement-breakpoint
DROP TRIGGER `officer_work_commitment_insert_guard_v6`;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_insert_guard_v6`
BEFORE INSERT ON `officer_work_commitments`
WHEN NEW.`environment` = 'production' AND NEW.`status` <> 'cancelled'
BEGIN

  SELECT (CASE WHEN
    NEW.`integrity_state` <> 'verified'
    OR NEW.`status` <> 'declared'
    OR julianday(NEW.`starts_at`) IS NULL
    OR julianday(NEW.`ends_at`) IS NULL
    OR julianday(NEW.`ends_at`) <= julianday(NEW.`starts_at`)
    OR strftime('%f',NEW.`starts_at`) <> '00.000'
    OR strftime('%f',NEW.`ends_at`) <> '00.000'
    OR length(trim(NEW.`source_type`)) = 0
    OR length(trim(NEW.`source_reference`)) = 0
    OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) = 0
    OR julianday(NEW.`verified_at`) IS NULL
    OR julianday(NEW.`verified_at`) > julianday(CURRENT_TIMESTAMP, '+5 minutes')
    OR julianday(NEW.`expires_at`) IS NULL
    OR julianday(NEW.`expires_at`) < julianday(NEW.`ends_at`)
  THEN RAISE(ABORT,'production_work_commitment_evidence_invalid') END);

  SELECT (CASE WHEN
    EXISTS (
      SELECT 1 FROM `roster_assignments` ra
      JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
      WHERE ra.`officer_id` = NEW.`officer_id`
        AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
        AND ra.`status` NOT IN ('cancelled','replaced','released')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `relief_dispatches` rd
      JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
      WHERE rd.`replacement_officer_id` = NEW.`officer_id`
        AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
        AND rd.`status` NOT IN ('cancelled','replaced')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `officer_work_commitments` other
      WHERE other.`id` <> NEW.`id`
        AND other.`officer_id` = NEW.`officer_id`
        AND other.`environment` = 'production'
        AND other.`integrity_state` = 'verified'
        AND other.`status` = 'declared'
        AND julianday(other.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(other.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
  THEN RAISE(ABORT,'production_work_commitment_rest_conflict') END);

  INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'officer_work_commitments',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review weekly hours across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS (
    SELECT 1 FROM `workforce_engagements` we
    WHERE we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND ((SELECT cap_minutes/60 FROM current_hourly_pay_rules) IS NULL OR (SELECT cap_minutes/60 FROM current_hourly_pay_rules) <= 0)
  )) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;

  INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'officer_work_commitments',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review weekly hours across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS (
    WITH RECURSIVE commitment_weeks(`iso_week_start`) AS (
      SELECT date(NEW.`starts_at`,'+2 hours',
        printf('-%d days',(CAST(strftime('%w',NEW.`starts_at`,'+2 hours') AS INTEGER)+6)%7))
      UNION ALL
      SELECT date(`iso_week_start`,'+7 days') FROM commitment_weeks
      WHERE julianday(date(`iso_week_start`,'+7 days')||'T00:00:00+02:00') < julianday(NEW.`ends_at`)
    )
    SELECT 1 FROM commitment_weeks week
    JOIN `workforce_engagements` we
      ON we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND (SELECT cap_minutes/60 FROM current_hourly_pay_rules) > 0
    WHERE
      CAST(ROUND((
        MIN(julianday(NEW.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
        - MAX(julianday(NEW.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
      )*1440) AS INTEGER)
      + COALESCE((
        SELECT SUM(r.`reserved_minutes`)
        FROM `workforce_hour_reservations` r
        WHERE r.`officer_id` = NEW.`officer_id`
          AND r.`status` = 'active'
          AND r.`iso_week_start` = week.`iso_week_start`
          AND (
            (r.`source_type` = 'assignment' AND EXISTS (
              SELECT 1 FROM `roster_assignments` ra
              WHERE ra.`id` = r.`source_id` AND ra.`id` = r.`roster_assignment_id`
                AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
            ))
            OR
            (r.`source_type` = 'relief' AND EXISTS (
              SELECT 1 FROM `relief_dispatches` rd
              WHERE rd.`id` = r.`source_id` AND rd.`id` = r.`relief_dispatch_id`
                AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
            ))
          )
      ),0)
      + COALESCE((
        SELECT SUM(CAST(ROUND((
          MIN(julianday(other.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
          - MAX(julianday(other.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
        )*1440) AS INTEGER))
        FROM `officer_work_commitments` other
        WHERE other.`id` <> NEW.`id`
          AND other.`officer_id` = NEW.`officer_id`
          AND other.`environment` = 'production'
          AND other.`integrity_state` = 'verified'
          AND other.`status` = 'declared'
          AND julianday(other.`starts_at`) < julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
          AND julianday(other.`ends_at`) > julianday(week.`iso_week_start`||'T00:00:00+02:00')
      ),0)
      > (SELECT cap_minutes/60 FROM current_hourly_pay_rules) * 60
  )) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;

END;
--> statement-breakpoint
DROP TRIGGER `officer_work_commitment_update_guard_v6`;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_update_guard_v6`
BEFORE UPDATE ON `officer_work_commitments`
WHEN NEW.`environment` = 'production' AND NEW.`status` <> 'cancelled'
BEGIN

  SELECT (CASE WHEN
    NEW.`integrity_state` <> 'verified'
    OR NEW.`status` <> 'declared'
    OR julianday(NEW.`starts_at`) IS NULL
    OR julianday(NEW.`ends_at`) IS NULL
    OR julianday(NEW.`ends_at`) <= julianday(NEW.`starts_at`)
    OR strftime('%f',NEW.`starts_at`) <> '00.000'
    OR strftime('%f',NEW.`ends_at`) <> '00.000'
    OR length(trim(NEW.`source_type`)) = 0
    OR length(trim(NEW.`source_reference`)) = 0
    OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) = 0
    OR julianday(NEW.`verified_at`) IS NULL
    OR julianday(NEW.`verified_at`) > julianday(CURRENT_TIMESTAMP, '+5 minutes')
    OR julianday(NEW.`expires_at`) IS NULL
    OR julianday(NEW.`expires_at`) < julianday(NEW.`ends_at`)
  THEN RAISE(ABORT,'production_work_commitment_evidence_invalid') END);

  SELECT (CASE WHEN
    EXISTS (
      SELECT 1 FROM `roster_assignments` ra
      JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
      WHERE ra.`officer_id` = NEW.`officer_id`
        AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
        AND ra.`status` NOT IN ('cancelled','replaced','released')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `relief_dispatches` rd
      JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
      WHERE rd.`replacement_officer_id` = NEW.`officer_id`
        AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
        AND rd.`status` NOT IN ('cancelled','replaced')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `officer_work_commitments` other
      WHERE other.`id` <> NEW.`id`
        AND other.`officer_id` = NEW.`officer_id`
        AND other.`environment` = 'production'
        AND other.`integrity_state` = 'verified'
        AND other.`status` = 'declared'
        AND julianday(other.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(other.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
  THEN RAISE(ABORT,'production_work_commitment_rest_conflict') END);

  INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'officer_work_commitments',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review weekly hours across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS (
    SELECT 1 FROM `workforce_engagements` we
    WHERE we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND ((SELECT cap_minutes/60 FROM current_hourly_pay_rules) IS NULL OR (SELECT cap_minutes/60 FROM current_hourly_pay_rules) <= 0)
  )) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;

  INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'officer_work_commitments',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review weekly hours across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS (
    WITH RECURSIVE commitment_weeks(`iso_week_start`) AS (
      SELECT date(NEW.`starts_at`,'+2 hours',
        printf('-%d days',(CAST(strftime('%w',NEW.`starts_at`,'+2 hours') AS INTEGER)+6)%7))
      UNION ALL
      SELECT date(`iso_week_start`,'+7 days') FROM commitment_weeks
      WHERE julianday(date(`iso_week_start`,'+7 days')||'T00:00:00+02:00') < julianday(NEW.`ends_at`)
    )
    SELECT 1 FROM commitment_weeks week
    JOIN `workforce_engagements` we
      ON we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND (SELECT cap_minutes/60 FROM current_hourly_pay_rules) > 0
    WHERE
      CAST(ROUND((
        MIN(julianday(NEW.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
        - MAX(julianday(NEW.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
      )*1440) AS INTEGER)
      + COALESCE((
        SELECT SUM(r.`reserved_minutes`)
        FROM `workforce_hour_reservations` r
        WHERE r.`officer_id` = NEW.`officer_id`
          AND r.`status` = 'active'
          AND r.`iso_week_start` = week.`iso_week_start`
          AND (
            (r.`source_type` = 'assignment' AND EXISTS (
              SELECT 1 FROM `roster_assignments` ra
              WHERE ra.`id` = r.`source_id` AND ra.`id` = r.`roster_assignment_id`
                AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
            ))
            OR
            (r.`source_type` = 'relief' AND EXISTS (
              SELECT 1 FROM `relief_dispatches` rd
              WHERE rd.`id` = r.`source_id` AND rd.`id` = r.`relief_dispatch_id`
                AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
            ))
          )
      ),0)
      + COALESCE((
        SELECT SUM(CAST(ROUND((
          MIN(julianday(other.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
          - MAX(julianday(other.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
        )*1440) AS INTEGER))
        FROM `officer_work_commitments` other
        WHERE other.`id` <> NEW.`id`
          AND other.`officer_id` = NEW.`officer_id`
          AND other.`environment` = 'production'
          AND other.`integrity_state` = 'verified'
          AND other.`status` = 'declared'
          AND julianday(other.`starts_at`) < julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
          AND julianday(other.`ends_at`) > julianday(week.`iso_week_start`||'T00:00:00+02:00')
      ),0)
      > (SELECT cap_minutes/60 FROM current_hourly_pay_rules) * 60
  )) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;

END;
--> statement-breakpoint
DROP TRIGGER `production_payroll_period_insert_guard`;
--> statement-breakpoint
CREATE TRIGGER production_payroll_period_insert_guard BEFORE INSERT ON payroll_runs WHEN NEW.environment='production' BEGIN
 SELECT (CASE WHEN NEW.status<>'calculated' OR NEW.approved_by IS NOT NULL OR NEW.second_approved_by IS NOT NULL THEN RAISE(ABORT,'Production payroll must begin with an unapproved calculation') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM payroll_runs r WHERE r.environment='production' AND r.employer_id=NEW.employer_id AND r.pay_basis=NEW.pay_basis AND r.pay_cadence=NEW.pay_cadence AND r.status<>'voided' AND r.period_start<=NEW.period_end AND r.period_end>=NEW.period_start) THEN RAISE(ABORT,'An active payroll already covers this employer period') END);
END;
--> statement-breakpoint
DROP TRIGGER `production_payroll_snapshot_guard`;
--> statement-breakpoint
CREATE TRIGGER production_payroll_snapshot_guard BEFORE INSERT ON production_payroll_snapshots BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM shifts s JOIN roster_assignments ra ON ra.shift_id=s.id JOIN assignment_workforce_snapshots w ON w.roster_assignment_id=ra.id WHERE w.employer_id=json_extract(NEW.payload_json,'$.employerId') AND s.environment='production' AND s.scheduled_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd') AND s.status IN ('confirmed','on_post')) THEN RAISE(ABORT,'Unfinished service appeared before payroll commit') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_policy_versions p ON p.id=NEW.policy_id WHERE r.id=NEW.run_id AND r.environment='production' AND r.status='calculated' AND p.policy_hash=json_extract(NEW.payload_json,'$.policyHash') AND r.employer_id=json_extract(NEW.payload_json,'$.employerId') AND r.period_start=json_extract(NEW.payload_json,'$.periodStart') AND r.period_end=json_extract(NEW.payload_json,'$.periodEnd') AND r.pay_date=json_extract(NEW.payload_json,'$.payDate') AND r.item_count=json_array_length(NEW.payload_json,'$.items') AND r.gross_cents=(SELECT SUM(json_extract(value,'$.calculation.grossCents')) FROM json_each(NEW.payload_json,'$.items')) AND r.net_pay_cents=(SELECT SUM(json_extract(value,'$.calculation.netPayCents')) FROM json_each(NEW.payload_json,'$.items'))) THEN RAISE(ABORT,'Payroll policy or totals changed before calculation commit') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.items') i WHERE NOT EXISTS(SELECT 1 FROM payroll_profiles p JOIN production_evidence_reviews e ON p.evidence_reference='review:'||e.id WHERE p.id=json_extract(i.value,'$.profileId') AND p.version=json_extract(i.value,'$.profileVersion') AND p.officer_id=json_extract(i.value,'$.officerId') AND p.workforce_engagement_id=json_extract(i.value,'$.engagementId') AND p.employer_id=json_extract(NEW.payload_json,'$.employerId') AND p.active_key=p.officer_id AND p.status='calculation_ready' AND p.environment='production' AND e.state='approved' AND julianday(e.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Payroll profile changed before calculation commit') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM json_each(NEW.payload_json,'$.items') i,json_each(i.value,'$.sources') s WHERE NOT EXISTS(SELECT 1 FROM shift_timesheets t WHERE t.id=json_extract(s.value,'$.id') AND t.version=json_extract(s.value,'$.version') AND t.officer_id=json_extract(i.value,'$.officerId') AND t.employer_id=json_extract(NEW.payload_json,'$.employerId') AND t.workforce_engagement_id=json_extract(i.value,'$.engagementId') AND t.environment='production' AND t.integrity_state='production_verified' AND t.service_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd') AND t.active_key=t.shift_id AND t.gross_wage_cents=json_extract(s.value,'$.gross_wage_cents') AND t.payable_minutes=json_extract(s.value,'$.payable_minutes') AND t.operations_status='approved_for_backend' AND t.client_evidence_status='confirmed' AND NOT EXISTS(SELECT 1 FROM pay_item_sources p WHERE p.active_key=t.id))) THEN RAISE(ABORT,'Service pay evidence changed before calculation commit') END);
 SELECT (CASE WHEN (SELECT count(*) FROM shift_timesheets t JOIN workforce_engagements w ON w.id=t.workforce_engagement_id LEFT JOIN assignment_workforce_snapshots aw ON aw.roster_assignment_id=t.roster_assignment_id WHERE COALESCE(aw.pay_basis,w.pay_basis)=COALESCE(json_extract(NEW.payload_json,'$.payBasis'),'monthly') AND (COALESCE(aw.pay_basis,w.pay_basis)!='hourly' OR COALESCE(aw.pay_cadence,w.pay_cadence)=COALESCE(json_extract(NEW.payload_json,'$.payCadence'),'weekly')) AND t.environment='production' AND t.active_key=t.shift_id AND t.employer_id=json_extract(NEW.payload_json,'$.employerId') AND t.service_date BETWEEN json_extract(NEW.payload_json,'$.periodStart') AND json_extract(NEW.payload_json,'$.periodEnd'))<>(SELECT count(*) FROM json_each(NEW.payload_json,'$.items') i,json_each(i.value,'$.sources')) THEN RAISE(ABORT,'Payroll period service changed before commit') END);
END;
--> statement-breakpoint
DROP TRIGGER `production_payroll_decision_guard`;
--> statement-breakpoint
CREATE TRIGGER production_payroll_decision_guard BEFORE INSERT ON production_payroll_decisions BEGIN
 SELECT (CASE WHEN NEW.auth_basis NOT IN ('mfa_verified','owner_mfa_exception') OR julianday(NEW.created_at) IS NULL OR julianday(NEW.created_at)<julianday('now','-1 minute') OR julianday(NEW.created_at)>julianday('now','+1 minute') THEN RAISE(ABORT,'Fresh server authorisation is required') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN production_payroll_snapshots s ON s.run_id=r.id JOIN operator_accounts a ON a.id=NEW.operator_id JOIN operator_role_assignments role ON role.operator_id=a.id WHERE r.id=NEW.run_id AND r.environment='production' AND r.version=NEW.run_version AND r.net_pay_cents=NEW.amount_cents AND s.payload_hash=NEW.calculation_hash AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=NEW.amount_cents AND role.environment='production' AND role.integrity_state='production_verified' AND role.status='active' AND ((NEW.action='first_approve_payroll' AND r.status='calculated' AND NEW.operator_id<>r.created_by AND role.role='payroll_reviewer') OR (NEW.action='second_approve_payroll' AND r.status='first_approved' AND NEW.operator_id NOT IN (r.created_by,r.approved_by) AND role.role='finance_approver') OR (NEW.action='export_payroll' AND r.status='approved_for_export' AND role.role='payroll_preparer') OR (NEW.action='void_payroll' AND r.status IN ('calculated','first_approved','approved_for_export') AND role.role='finance_approver'))) THEN RAISE(ABORT,'Payroll stage, amount or independent operator authority changed') END);
 SELECT (CASE WHEN NEW.action<>'void_payroll' AND NOT EXISTS(SELECT 1 FROM production_payroll_snapshots s JOIN payroll_policy_versions p ON p.id=s.policy_id WHERE s.run_id=NEW.run_id AND p.policy_hash=json_extract(s.payload_json,'$.policyHash')) THEN RAISE(ABORT,'Approved payroll policy is no longer current') END);
 SELECT (CASE WHEN NEW.action<>'void_payroll' AND EXISTS(SELECT 1 FROM production_payroll_snapshots s,json_each(s.payload_json,'$.items') i WHERE s.run_id=NEW.run_id AND NOT EXISTS(SELECT 1 FROM payroll_profiles p JOIN production_evidence_reviews e ON p.evidence_reference='review:'||e.id WHERE p.id=json_extract(i.value,'$.profileId') AND p.version=json_extract(i.value,'$.profileVersion') AND p.status='calculation_ready' AND p.active_key=p.officer_id AND e.state='approved' AND julianday(e.expires_at)>julianday('now'))) THEN RAISE(ABORT,'Payroll profile is no longer current') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_insert_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_pricing_insert_guard_v33`
AFTER INSERT ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment')
BEGIN
  SELECT (CASE WHEN COALESCE((SELECT `valid` FROM `specialist_pricing_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_pricing_floor_invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_update_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_pricing_update_guard_v33`
AFTER UPDATE OF `service_type`,`service_day_count`,`headcount`,`shift_count`,`officer_total_cents`,
  `gross_platform_contribution_cents`,`pricing_version`,`pricing_breakdown`,`specialist_service_code`,
  `specialist_configuration`,`quote_subtotal_cents`,`vat_rate_basis_points`,`vat_cents`,`cost_floor_cents`,
  `margin_cents`,`margin_basis_points`,`minimum_margin_basis_points`,`pricing_status`,`client_price_cents`
ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment')
BEGIN
  SELECT (CASE WHEN COALESCE((SELECT `valid` FROM `specialist_pricing_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_pricing_floor_invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_pricing_version_immutable_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_pricing_version_immutable_v33`
BEFORE UPDATE OF `pricing_version` ON `bookings`
FOR EACH ROW WHEN OLD.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') AND NEW.`pricing_version` <> OLD.`pricing_version`
BEGIN
  SELECT RAISE(ABORT,'specialist_pricing_version_immutable');
END;
--> statement-breakpoint
DROP TRIGGER `specialist_booking_progress_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_booking_progress_guard_v33`
BEFORE UPDATE OF `status`,`funding_status`,`pricing_status` ON `bookings`
FOR EACH ROW WHEN NEW.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment')
  AND (NEW.`status` IN ('awaiting_payment','matching','offered','partially_staffed','staffed','active')
    OR NEW.`funding_status` = 'paid_in_full')
BEGIN
  SELECT (CASE WHEN NEW.`pricing_status` <> 'authoritative'
    THEN RAISE(ABORT,'specialist_partner_or_pricing_review_required') END);
  SELECT (CASE WHEN COALESCE((SELECT `assignment_plan_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_assignment_plan_not_current') END);
  SELECT (CASE WHEN COALESCE((SELECT `specialist_authority_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_service_authority_not_current') END);
  SELECT (CASE WHEN (NEW.`status` IN ('matching','offered','partially_staffed','staffed','active') OR NEW.`funding_status` = 'paid_in_full')
    AND COALESCE((SELECT `funding_current` FROM `specialist_booking_control_validation_v33` WHERE `id` = NEW.`id`),0) <> 1
    THEN RAISE(ABORT,'specialist_full_cleared_advance_funding_required') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_offer_insert_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_offer_insert_guard_v33`
BEFORE INSERT ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
  AND EXISTS (SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
    AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `bookings` booking
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE booking.`id` = NEW.`booking_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_offer_controls_not_current') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_offer_update_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_offer_update_guard_v33`
BEFORE UPDATE OF `status` ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
  AND EXISTS (SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
    AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `bookings` booking
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE booking.`id` = NEW.`booking_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_offer_controls_not_current') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_activation_guard_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_activation_guard_v33`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
FOR EACH ROW WHEN NEW.`state` = 'activated' AND EXISTS (
  SELECT 1 FROM `roster_slots` slot JOIN `bookings` booking ON booking.`id` = slot.`booking_id`
  WHERE slot.`id` = NEW.`roster_slot_id` AND booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment'))
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM `roster_slots` slot
    JOIN `bookings` booking ON booking.`id` = slot.`booking_id`
    JOIN `specialist_booking_control_validation_v33` control ON control.`id` = booking.`id`
    WHERE slot.`id` = NEW.`roster_slot_id` AND booking.`pricing_status` = 'authoritative'
      AND booking.`credit_terms_days` = 0 AND booking.`funding_model` = 'advance_only'
      AND booking.`funding_status` = 'paid_in_full'
      AND control.`assignment_plan_current` = 1 AND control.`specialist_authority_current` = 1
      AND control.`funding_current` = 1
  ) THEN RAISE(ABORT,'specialist_activation_controls_not_current') END);
END;
--> statement-breakpoint
DROP TRIGGER `specialist_activated_booking_immutable_v33`;
--> statement-breakpoint
CREATE TRIGGER `specialist_activated_booking_immutable_v33`
BEFORE UPDATE OF `service_type`,`service_day_count`,`headcount`,`shift_count`,`officer_total_cents`,
  `gross_platform_contribution_cents`,`pricing_breakdown`,`specialist_service_code`,`specialist_configuration`,
  `quote_subtotal_cents`,`vat_rate_basis_points`,`vat_cents`,`cost_floor_cents`,`margin_cents`,
  `margin_basis_points`,`minimum_margin_basis_points`,`pricing_status`,`client_price_cents`
ON `bookings`
FOR EACH ROW WHEN OLD.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment')
  AND EXISTS (SELECT 1 FROM `assignment_activation_snapshots` snapshot WHERE snapshot.`booking_id` = OLD.`id` AND snapshot.`final` = 1)
BEGIN
  SELECT RAISE(ABORT,'specialist_activated_booking_immutable');
END;
--> statement-breakpoint
DROP TRIGGER `specialist_commercial_reviews_insert_shape_v34`;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_insert_shape_v34 BEFORE INSERT ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=(CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END)
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.status<>'review' OR NEW.approved_by IS NOT NULL OR NEW.version<>1 THEN RAISE(ABORT,'specialist_initial_review_required') END);
 END;
--> statement-breakpoint
DROP TRIGGER `specialist_commercial_reviews_update_shape_v34`;
--> statement-breakpoint
CREATE TRIGGER specialist_commercial_reviews_update_shape_v34 BEFORE UPDATE ON specialist_commercial_reviews
 BEGIN
 SELECT (CASE WHEN NOT COALESCE(NEW.environment IN ('demo','production') AND NEW.integrity_state=(CASE NEW.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END)
 AND NEW.status IN ('draft','review','approved','revoked') AND length(trim(NEW.prepared_by))>0 AND (NEW.pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') AND NEW.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1' AND julianday(NEW.expires_at) IS NOT NULL AND length(trim(NEW.evidence_reference))>0),0)
 THEN RAISE(ABORT,'specialist_record_shape_invalid') END);
 SELECT (CASE WHEN NEW.id<>OLD.id OR NEW.environment<>OLD.environment OR NEW.integrity_state<>OLD.integrity_state OR NEW.version<>OLD.version+1
 THEN RAISE(ABORT,'specialist_revision_conflict') END);
 END;
--> statement-breakpoint
DROP TRIGGER `activation_snapshot_authoritative_calendar_wage_v1`;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_authoritative_calendar_wage_v1`
BEFORE INSERT ON `assignment_activation_snapshots`
WHEN NEW.`environment` = 'production'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		WITH source AS (
			SELECT rs.`service_date`, date(rs.`starts_at`, '+2 hours') AS derived_service_date,
				CAST(strftime('%Y', date(rs.`starts_at`, '+2 hours')) AS INTEGER) AS y,
				b.`pricing_version`, rs.`calendar_category` AS stored_calendar_category,
				rs.`officer_offer_cents` AS stored_officer_offer_cents, b.`service_type`, b.specialist_service_code, price.valid AS specialist_price_valid,
				b.`engagement_model`, sra.`risk_band`
			FROM `assignment_activation_commands` command
			JOIN `roster_slots` rs ON rs.`id` = command.`roster_slot_id`
			JOIN `bookings` b ON b.`id` = rs.`booking_id`
			LEFT JOIN specialist_pricing_validation_v33 price ON price.id=b.id
			JOIN `site_risk_assessments` sra ON sra.`id` = NEW.`risk_assessment_id`
				AND sra.`site_id` = rs.`site_id` AND sra.`active_key` = rs.`site_id`
			WHERE command.`id` = NEW.`command_id`
		), easter_1 AS (
			SELECT *, y % 19 AS a, CAST(y / 100 AS INTEGER) AS b, y % 100 AS c FROM source
		), easter_2 AS (
			SELECT *, CAST(b / 4 AS INTEGER) AS d, b % 4 AS e,
				CAST((b + 8) / 25 AS INTEGER) AS f FROM easter_1
		), easter_3 AS (
			SELECT *, CAST((b - f + 1) / 3 AS INTEGER) AS g,
				(19 * a + b - d - CAST((b - f + 1) / 3 AS INTEGER) + 15) % 30 AS h,
				CAST(c / 4 AS INTEGER) AS i, c % 4 AS k FROM easter_2
		), easter_4 AS (
			SELECT *, (32 + 2 * e + 2 * i - h - k) % 7 AS l FROM easter_3
		), easter_5 AS (
			SELECT *, CAST((a + 11 * h + 22 * ((32 + 2 * e + 2 * i - h - k) % 7)) / 451 AS INTEGER) AS m
			FROM easter_4
		), easter_day AS (
			SELECT *, printf('%04d-%02d-%02d', y,
				CAST((h + l - 7 * m + 114) / 31 AS INTEGER),
				((h + l - 7 * m + 114) % 31) + 1) AS easter_sunday
			FROM easter_5
		), classified AS (
			SELECT *, CASE
				WHEN strftime('%m-%d', derived_service_date) IN ('12-25','12-26') THEN 'christmas'
				WHEN derived_service_date IN (date(easter_sunday, '-2 days'), easter_sunday, date(easter_sunday, '+1 day')) THEN 'easter'
				WHEN strftime('%m-%d', derived_service_date) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16')
					OR (strftime('%w', derived_service_date) = '1' AND strftime('%m-%d', date(derived_service_date, '-1 day'))
						IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26'))
					THEN 'public_holiday'
				WHEN strftime('%w', derived_service_date) = '0' THEN 'sunday'
				ELSE 'ordinary'
			END AS authoritative_calendar_category
			FROM easter_day
		), priced AS (
			SELECT *,
				CASE WHEN pricing_version='LOKD-PREMIUM-2026.09' AND service_type='Unarmed' THEN 80000
                WHEN pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') THEN CASE specialist_service_code
                 WHEN 'standard_unarmed' THEN 80000 WHEN 'armed_static' THEN 200000 WHEN 'armed_movement' THEN 220000
                 WHEN 'vip_unarmed' THEN 450000 WHEN 'vip_armed' THEN 550000 WHEN 'vip_protective_driver' THEN 500000 WHEN 'vip_team' THEN 480000 END END AS base_wage_cents,
				CASE risk_band WHEN 'Standard' THEN 1.0 WHEN 'Enhanced' THEN 1.0 WHEN 'Elevated' THEN 1.05
					WHEN 'High' THEN 1.1 WHEN 'Critical' THEN 1.2 END AS risk_multiplier,
				CASE authoritative_calendar_category
					WHEN 'ordinary' THEN 1.0
					WHEN 'sunday' THEN CASE engagement_model WHEN 'bolt' THEN 2.0 WHEN 'flex' THEN 2.0 WHEN 'fixed' THEN 1.5 END
					WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5
				END AS calendar_multiplier
			FROM classified
		)
		SELECT 1 FROM priced
		WHERE service_date = derived_service_date
			AND ((pricing_version='LOKD-PREMIUM-2026.09' AND service_type='Unarmed') OR (pricing_version IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') AND specialist_price_valid=1))
			AND engagement_model IN ('bolt','fixed','flex')
			AND base_wage_cents IS NOT NULL AND risk_multiplier IS NOT NULL AND calendar_multiplier IS NOT NULL
			AND stored_calendar_category = authoritative_calendar_category
			AND NEW.`calendar_category` = authoritative_calendar_category
			AND NEW.`pricing_version` = pricing_version
			AND NEW.`ordinary_wage_cents` = CAST(ROUND(base_wage_cents * risk_multiplier) AS INTEGER)
			AND NEW.`funded_offer_cents` = CAST(ROUND(base_wage_cents * risk_multiplier * calendar_multiplier) AS INTEGER)
			AND stored_officer_offer_cents = NEW.`funded_offer_cents`
			AND NEW.`holiday_premium_cents` = NEW.`funded_offer_cents` - NEW.`ordinary_wage_cents`
			AND NEW.`statutory_cost_cents` = CASE WHEN NEW.`workforce_model` = 'partner' THEN 0
				ELSE CAST(ROUND(NEW.`funded_offer_cents` * 0.15) AS INTEGER) END
	) THEN RAISE(ABORT, 'activation_authoritative_calendar_wage_invalid') END);
END;
--> statement-breakpoint
DROP TRIGGER `lokd_workforce_only_insert`;
--> statement-breakpoint
CREATE TRIGGER lokd_workforce_only_insert BEFORE INSERT ON workforce_engagements WHEN NEW.environment='production' AND (NEW.model NOT IN ('direct_flex','managed') OR NOT EXISTS(SELECT 1 FROM workforce_employers e WHERE e.id=NEW.employer_id AND e.employer_type='lokd_employer' AND e.environment='production')) BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
DROP TRIGGER `lokd_workforce_only_active`;
--> statement-breakpoint
CREATE TRIGGER lokd_workforce_only_active BEFORE UPDATE ON workforce_engagements WHEN NEW.environment='production' AND NEW.status='active' AND (NEW.model NOT IN ('direct_flex','managed') OR NOT EXISTS(SELECT 1 FROM workforce_employers e WHERE e.id=NEW.employer_id AND e.employer_type='lokd_employer' AND e.environment='production')) BEGIN SELECT RAISE(ABORT,'lokd_employer_required'); END;
--> statement-breakpoint
DROP TRIGGER `activation_command_final_hardening_v2`;
--> statement-breakpoint
CREATE TRIGGER `activation_command_final_hardening_v2`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id` AND b.`id` = rs.`booking_id`
		JOIN `booking_funding_reconciliations` fr ON fr.`id` = snap.`funding_reconciliation_id`
		JOIN `site_risk_assessments` sra ON sra.`id` = snap.`risk_assessment_id`
		JOIN `post_order_approvals` poa ON poa.`id` = snap.`post_order_approval_id`
		JOIN `officer_site_inductions` osi ON osi.`id` = snap.`induction_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`environment` = 'production'
			AND snap.`integrity_state` = 'production_verified' AND snap.`evidence_valid_through` = rs.`ends_at`
			AND fr.`booking_id` = snap.`booking_id` AND fr.`active_key` = snap.`booking_id`
			AND fr.`environment` = 'production' AND fr.`integrity_state` = 'verified'
			AND fr.`status` = 'cleared_reconciled' AND fr.`provider` <> 'demo_manual'
			AND length(trim(fr.`provider_reference`)) > 0 AND fr.`currency` = 'ZAR'
			AND fr.`expected_amount_cents` = b.`client_price_cents`
			AND fr.`cleared_amount_cents` >= fr.`expected_amount_cents`
			AND length(trim(fr.`evidence_reference`)) > 0
			AND julianday(fr.`cleared_at`) <= julianday('now')
			AND julianday(fr.`reconciled_at`) <= julianday('now')
			AND julianday(fr.`evidence_verified_at`) <= julianday('now')
			AND fr.`evidence_expires_at` IS NOT NULL AND julianday(fr.`evidence_expires_at`) >= julianday(rs.`ends_at`)
			AND sra.`site_id` = snap.`site_id` AND sra.`active_key` = snap.`site_id`
			AND sra.`status` = 'approved' AND sra.`environment` = 'production' AND sra.`integrity_state` = 'verified'
			AND length(trim(sra.`evidence_reference`)) > 0
			AND julianday(sra.`approved_at`) <= julianday('now')
			AND julianday(sra.`valid_from`) <= julianday(rs.`starts_at`)
			AND sra.`expires_at` IS NOT NULL AND julianday(sra.`expires_at`) >= julianday(rs.`ends_at`)
			AND poa.`post_id` = snap.`post_id` AND poa.`active_key` = snap.`post_id`
			AND poa.`status` = 'approved' AND poa.`environment` = 'production' AND poa.`integrity_state` = 'verified'
			AND poa.`post_orders_version` = (SELECT sp.`post_orders_version` FROM `site_posts` sp WHERE sp.`id` = snap.`post_id`)
			AND length(trim(poa.`evidence_reference`)) > 0
			AND julianday(poa.`approved_at`) <= julianday('now')
			AND julianday(poa.`valid_from`) <= julianday(rs.`starts_at`)
			AND poa.`expires_at` IS NOT NULL AND julianday(poa.`expires_at`) >= julianday(rs.`ends_at`)
			AND osi.`officer_id` = snap.`officer_id` AND osi.`site_id` = snap.`site_id`
			AND osi.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND osi.`status` = 'completed' AND osi.`environment` = 'production' AND osi.`integrity_state` = 'verified'
			AND length(trim(osi.`evidence_reference`)) > 0
			AND julianday(osi.`completed_at`) <= julianday('now')
			AND osi.`expires_at` IS NOT NULL AND julianday(osi.`expires_at`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_funding_site_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `officers` o ON o.`id` = snap.`officer_id`
		JOIN `officer_passports` op ON op.`officer_id` = o.`id`
		JOIN `officer_services` svc ON svc.`officer_id` = o.`id` AND svc.`service_type` = sp.`service_type`
		WHERE snap.`command_id` = NEW.`id` AND o.`approval_status` = 'approved'
			AND o.`external_work_acknowledged` = 1 AND o.`rest_window_confirmed` = 1
			AND date(o.`psira_expiry`) >= date(rs.`ends_at`, '+2 hours')
			AND (CASE replace(upper(trim(o.`psira_grade`)), 'GRADE ', '')
				WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 0 END)
				>= (CASE replace(upper(trim(sp.`minimum_grade`)), 'GRADE ', '')
				WHEN 'A' THEN 5 WHEN 'B' THEN 4 WHEN 'C' THEN 3 WHEN 'D' THEN 2 WHEN 'E' THEN 1 ELSE 99 END)
			AND op.`status` IN ('active','expiring') AND op.`environment` = 'production' AND op.`integrity_state` = 'verified'
			AND length(trim(op.`evidence_reference`)) > 0
			AND julianday(op.`last_reviewed_at`) <= julianday('now')
			AND op.`next_review_at` IS NOT NULL AND julianday(op.`next_review_at`) >= julianday(rs.`ends_at`)
			AND svc.`qualified` = 1 AND svc.`opted_in` = 1
			AND date(svc.`qualification_expiry`) >= date(rs.`ends_at`, '+2 hours')
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'identity' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday('now')
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `compliance_records` cr
				WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'psira' AND cr.`status` = 'current'
					AND cr.`environment` = 'production' AND cr.`integrity_state` = 'verified'
					AND length(trim(cr.`evidence_reference`)) > 0
					AND julianday(cr.`verified_at`) <= julianday('now')
					AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(rs.`ends_at`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`code` = 'core_ready' AND oe.`status` = 'current'
					AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'service' AND oe.`service_type` = sp.`service_type`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe
				WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'purpose' AND oe.`purpose_code` = sp.`purpose_code`
					AND oe.`status` = 'current' AND oe.`environment` = 'production' AND oe.`integrity_state` = 'verified'
					AND length(trim(oe.`evidence_reference`)) > 0
					AND julianday(oe.`assessed_at`) <= julianday('now')
					AND date(oe.`expires_at`) >= date(rs.`ends_at`, '+2 hours'))
	) THEN RAISE(ABORT, 'production_officer_evidence_invalid') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `workforce_engagements` we ON we.`id` = snap.`workforce_engagement_id`
		JOIN `workforce_employers` emp ON emp.`id` = snap.`employer_id` AND emp.`id` = we.`employer_id`
		JOIN `workforce_terms_acceptances` wta ON wta.`id` = snap.`terms_acceptance_id`
		WHERE snap.`command_id` = NEW.`id` AND we.`officer_id` = snap.`officer_id`
			AND we.`status` = 'active' AND we.`active_key` = we.`officer_id` AND we.`environment` = 'production'
			AND we.`model` = snap.`workforce_model` AND we.`terms_version` = snap.`terms_version`
			
			AND emp.`environment` = 'production'
			AND emp.`version` = snap.`employer_version` AND emp.`legal_name` = snap.`employer_legal_name`
			
			AND ((we.`model` IN ('direct_flex','managed') AND emp.`employer_type` = 'lokd_employer'
				))
			AND wta.`workforce_engagement_id` = we.`id` AND wta.`officer_id` = snap.`officer_id`
			AND wta.`active_key` = we.`id` AND wta.`terms_version` = we.`terms_version`
			AND wta.`environment` = 'production' AND wta.`integrity_state` = 'verified'
			AND length(trim(wta.`evidence_reference`)) > 0
			AND julianday(wta.`accepted_at`) <= julianday('now')
			AND wta.`expires_at` IS NOT NULL AND julianday(wta.`expires_at`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_workforce_route_invalid') END);

	INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'assignment_activation_commands',NEW.id,NULL,'EMPLOYER_EVIDENCE_REVIEW','Review missing or expired employer compliance evidence',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (
		SELECT COUNT(DISTINCT ece.`control_code`) FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `employer_compliance_evidence` ece ON ece.`employer_id` = snap.`employer_id`
		WHERE snap.`command_id` = NEW.`id`
			AND ece.`control_code` IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement')
			AND ece.`active_key` = ece.`employer_id` || ':' || ece.`control_code`
			AND ece.`status` = 'current' AND ece.`environment` = 'production' AND ece.`integrity_state` = 'verified'
			AND length(trim(ece.`evidence_reference`)) > 0
			AND julianday(ece.`verified_at`) <= julianday('now')
			AND ece.`expires_at` IS NOT NULL AND julianday(ece.`expires_at`) >= julianday(rs.`ends_at`)
	) <> 7;
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0;

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `officer_availability_windows` av ON av.`officer_id` = snap.`officer_id`
		JOIN `officer_travel_assessments` ota ON ota.`officer_id` = snap.`officer_id` AND ota.`site_id` = snap.`site_id`
		WHERE snap.`command_id` = NEW.`id`
			AND av.`status` = 'available' AND av.`environment` = 'production' AND av.`integrity_state` = 'verified'
			AND length(trim(av.`evidence_reference`)) > 0 AND julianday(av.`rest_confirmed_at`) <= julianday('now')
			AND julianday(av.`starts_at`) <= julianday(rs.`starts_at`) AND julianday(av.`ends_at`) >= julianday(rs.`ends_at`)
			AND ota.`status` = 'feasible' AND ota.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND ota.`environment` = 'production' AND ota.`integrity_state` = 'verified'
			AND length(trim(ota.`evidence_reference`)) > 0 AND julianday(ota.`assessed_at`) <= julianday('now')
			AND ota.`valid_until` IS NOT NULL AND julianday(ota.`valid_until`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_availability_travel_invalid') END);

	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `roster_assignments` other
		JOIN `roster_slots` other_slot ON other_slot.`id` = other.`roster_slot_id`
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE other.`officer_id` = NEW.`officer_id` AND other.`id` <> NEW.`roster_assignment_id`
			AND other.`environment` = 'production' AND other.`integrity_state` = 'production_verified'
			AND other.`status` NOT IN ('cancelled','replaced','released')
			AND julianday(other_slot.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(other_slot.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) OR EXISTS (
		SELECT 1 FROM `relief_dispatches` rd
		JOIN `roster_slots` relief_slot ON relief_slot.`id` = rd.`roster_slot_id`
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE rd.`replacement_officer_id` = NEW.`officer_id`
			AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
			AND rd.`status` NOT IN ('cancelled','replaced')
			AND julianday(relief_slot.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(relief_slot.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) OR EXISTS (
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `roster_slots` candidate ON candidate.`id` = NEW.`roster_slot_id`
		WHERE owc.`officer_id` = NEW.`officer_id`
			AND owc.`environment` = 'production' AND owc.`integrity_state` = 'verified'
			AND owc.`status` <> 'cancelled'
			AND julianday(owc.`starts_at`) < julianday(candidate.`ends_at`, '+8 hours')
			AND julianday(owc.`ends_at`) > julianday(candidate.`starts_at`, '-8 hours')
	) THEN RAISE(ABORT, 'officer_work_rest_conflict') END);

	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id`
		JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`pricing_version` = b.`pricing_version`
			AND snap.`calendar_category` = b.`calendar_category`
			AND b.`calendar_category` IN ('ordinary','sunday','public_holiday','easter','christmas')
			AND snap.`funded_offer_cents` = b.`officer_rate_cents`
			AND snap.`ordinary_wage_cents` = CAST(ROUND(b.`officer_rate_cents` / (CASE b.`calendar_category`
				WHEN 'ordinary' THEN 1.0 WHEN 'sunday' THEN CASE b.`engagement_model` WHEN 'bolt' THEN 2.0 WHEN 'flex' THEN 2.0 ELSE 1.5 END
				WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5 END)) AS INTEGER)
			AND snap.`holiday_premium_cents` = snap.`funded_offer_cents` - snap.`ordinary_wage_cents`
			AND snap.`statutory_cost_cents` = CAST(ROUND(snap.`funded_offer_cents` * 0.15) AS INTEGER)
			AND sh.`booking_id` = snap.`booking_id` AND sh.`officer_id` = snap.`officer_id`
			AND sh.`earnings_cents` = snap.`funded_offer_cents`
			AND snap.`reserved_minutes` = CAST(ROUND((julianday(rs.`ends_at`) - julianday(rs.`starts_at`)) * 1440) AS INTEGER)
	) THEN RAISE(ABORT, 'production_frozen_economics_invalid') END);

	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` = 'direct_flex'
			AND NOT EXISTS (
				SELECT 1 FROM `workforce_hour_reservations` h
				WHERE h.`command_id` = NEW.`id` AND h.`roster_assignment_id` = NEW.`roster_assignment_id`
					AND h.`officer_id` = NEW.`officer_id` AND h.`source_type` = 'assignment' AND h.`status` = 'active'
				GROUP BY h.`command_id`
				HAVING SUM(h.`reserved_minutes`) = snap.`reserved_minutes`
					AND julianday(MIN(h.`segment_starts_at`)) = julianday(rs.`starts_at`)
					AND julianday(MAX(h.`segment_ends_at`)) = julianday(rs.`ends_at`))
	) THEN RAISE(ABORT, 'direct_flex_hour_coverage_invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` <> 'direct_flex'
			AND EXISTS (SELECT 1 FROM `workforce_hour_reservations` h WHERE h.`command_id` = NEW.`id` AND h.`status` = 'active')
	) THEN RAISE(ABORT, 'non_flex_hour_reservation_invalid') END);
END;
--> statement-breakpoint
DROP VIEW `specialist_booking_control_validation_v33`;
--> statement-breakpoint
CREATE VIEW `specialist_booking_control_validation_v33` AS
SELECT booking.`id`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `operational_sites` site
    JOIN `site_posts` post ON post.`site_id` = site.`id` AND post.`booking_id` = booking.`id`
    JOIN `site_risk_assessments` risk ON risk.`site_id` = site.`id`
    JOIN `post_order_approvals` orders ON orders.`post_id` = post.`id`
    WHERE site.`booking_id` = booking.`id` AND site.`client_id` = booking.`client_id`
      AND site.`status` = 'active' AND post.`status` = 'active'
      AND site.`environment` = booking.`environment` AND site.`integrity_state` = booking.`integrity_state`
      AND post.`environment` = booking.`environment` AND post.`integrity_state` = booking.`integrity_state`
      AND risk.`environment` = booking.`environment` AND (risk.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND risk.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND risk.`id` = 'RISK-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND orders.`environment` = booking.`environment` AND (orders.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND orders.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND orders.`id` = 'POST-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND risk.`status` = 'approved' AND risk.`active_key` = site.`id`
      AND risk.`evidence_reference` IS NOT NULL AND length(trim(risk.`evidence_reference`)) >= 8
      AND risk.`approved_at` IS NOT NULL AND julianday(risk.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND risk.`valid_from` IS NOT NULL
      AND julianday(risk.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND risk.`expires_at` IS NOT NULL
      AND julianday(risk.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`status` = 'approved' AND orders.`active_key` = post.`id`
      AND orders.`post_orders_version` = post.`post_orders_version`
      AND orders.`evidence_reference` IS NOT NULL AND length(trim(orders.`evidence_reference`)) >= 8
      AND orders.`approved_at` IS NOT NULL AND julianday(orders.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND orders.`valid_from` IS NOT NULL
      AND julianday(orders.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`expires_at` IS NOT NULL
      AND julianday(orders.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND EXISTS (SELECT 1 FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`)
  ) THEN 1 ELSE 0 END AS `assignment_plan_current`,
  1 AS `specialist_authority_current`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `booking_funding_reconciliations` funding
    WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
      AND funding.`environment` = booking.`environment` AND funding.`integrity_state` = booking.`integrity_state`
      AND funding.`currency` = 'ZAR' AND funding.`status` = 'cleared_reconciled'
      AND funding.`expected_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_at` IS NOT NULL AND funding.`reconciled_at` IS NOT NULL
      AND funding.`evidence_reference` IS NOT NULL AND length(trim(funding.`evidence_reference`)) >= 8
      AND funding.`evidence_verified_at` IS NOT NULL
      AND julianday(funding.`evidence_verified_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND funding.`evidence_expires_at` IS NOT NULL
      AND julianday(funding.`evidence_expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
  ) THEN 1 ELSE 0 END AS `funding_current`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment');
--> statement-breakpoint
CREATE TRIGGER hourly_offer_warning AFTER INSERT ON offers WHEN NEW.status IN ('open','accepted') BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'offers',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review hourly-pay hours above the weekly threshold across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS(SELECT 1 FROM hourly_shift_hour_checks WHERE officer_id=NEW.officer_id AND slot_id=COALESCE(NEW.roster_slot_id,(SELECT min(id) FROM roster_slots WHERE booking_id=NEW.booking_id HAVING count(*)=1)) AND projected_minutes>cap_minutes)) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;
--> statement-breakpoint
CREATE TRIGGER hourly_acceptance_warning AFTER INSERT ON officer_offer_responses WHEN NEW.response='accepted' BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'officer_offer_responses',NEW.id,(SELECT officer_id FROM offers WHERE id=NEW.offer_id),'WEEKLY_HOURS_REVIEW','Review hourly-pay hours above the weekly threshold across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS(SELECT 1 FROM hourly_shift_hour_checks WHERE officer_id=(SELECT officer_id FROM offers WHERE id=NEW.offer_id) AND slot_id=(SELECT slot_id FROM employment_offer_slots WHERE offer_id=NEW.offer_id) AND projected_minutes>cap_minutes)) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=(SELECT officer_id FROM offers WHERE id=NEW.offer_id) AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;
--> statement-breakpoint
CREATE TRIGGER hourly_activation_warning AFTER INSERT ON assignment_activation_snapshots WHEN NEW.environment='production' BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'assignment_activation_snapshots',NEW.id,NEW.officer_id,'WEEKLY_HOURS_REVIEW','Review hourly-pay hours above the weekly threshold across all assignments',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE (EXISTS(SELECT 1 FROM hourly_shift_hour_checks WHERE officer_id=NEW.officer_id AND slot_id=(SELECT roster_slot_id FROM assignment_activation_commands WHERE id=NEW.command_id) AND projected_minutes>cap_minutes)) AND EXISTS(SELECT 1 FROM workforce_engagements current_pay WHERE current_pay.officer_id=NEW.officer_id AND current_pay.pay_basis='hourly' AND current_pay.status='active' AND current_pay.active_key=current_pay.officer_id);
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;
--> statement-breakpoint
CREATE TRIGGER payroll_policy_status_warning AFTER INSERT ON production_payroll_snapshots BEGIN INSERT INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT lower(hex(randomblob(16))),'payroll_run',NEW.run_id,NULL,'PAYROLL_POLICY_APPROVAL_PENDING','Payroll used policy values before policy approval was complete',json_object('source','database rule'),'system:policy',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE EXISTS(SELECT 1 FROM payroll_policy_versions WHERE id=NEW.policy_id AND status!='active');
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-WARN-'||id,'operations',observed_by,'workforce_policy_warning','policy_warning',id,json_object('code',code,'detail',detail,'entityType',entity_type,'entityId',entity_id),created_at FROM workforce_policy_warnings WHERE rowid=last_insert_rowid() AND changes()>0; END;

--> statement-breakpoint
CREATE TRIGGER payroll_run_pay_basis_immutable BEFORE UPDATE OF pay_basis,pay_cadence ON payroll_runs WHEN NEW.pay_basis IS NOT OLD.pay_basis OR NEW.pay_cadence IS NOT OLD.pay_cadence BEGIN SELECT RAISE(ABORT,'Frozen payroll pay basis is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER workforce_snapshot_pay_basis_source BEFORE INSERT ON assignment_workforce_snapshots WHEN NEW.environment='production' BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workforce_engagements w WHERE w.id=NEW.workforce_engagement_id AND w.pay_basis=NEW.pay_basis AND w.agreed_hourly_rate_cents IS NEW.agreed_hourly_rate_cents AND w.pay_cadence=NEW.pay_cadence AND w.pay_cadence_request_reference IS NEW.pay_cadence_request_reference) THEN RAISE(ABORT,'Assignment pay basis must match its source at capture') END; END;

--> statement-breakpoint
DROP VIEW specialist_pricing_validation_v33;
--> statement-breakpoint
CREATE VIEW `specialist_pricing_validation_v33` AS
SELECT booking.`id`,
CASE WHEN
  booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment')
  AND (booking.pricing_version!='LOKD-SPECIALIST-2026.11-v3-employment' OR (json_type(booking.pricing_breakdown,'$.hourlyPremiumBasisPoints')='integer' AND json_extract(booking.pricing_breakdown,'$.hourlyPremiumBasisPoints')=COALESCE((SELECT json_extract(p.rules_json,'$.hourlyPay.premiumBasisPoints') FROM payroll_policy_versions p WHERE p.id=json_extract(booking.pricing_breakdown,'$.payrollPolicyId')),1500) AND json_type(booking.pricing_breakdown,'$.hourlyMinimumShiftMinutes')='integer' AND json_extract(booking.pricing_breakdown,'$.hourlyMinimumShiftMinutes')=COALESCE((SELECT json_extract(p.rules_json,'$.hourlyPay.minimumShiftMinutes') FROM payroll_policy_versions p WHERE p.id=json_extract(booking.pricing_breakdown,'$.payrollPolicyId')),240) AND json_type(booking.pricing_breakdown,'$.hourlyDivisor')='integer' AND json_extract(booking.pricing_breakdown,'$.hourlyDivisor')=COALESCE((SELECT json_extract(p.rules_json,'$.hourlyPay.hourlyDivisor') FROM payroll_policy_versions p WHERE p.id=json_extract(booking.pricing_breakdown,'$.payrollPolicyId')),208) AND json_type(booking.pricing_breakdown,'$.monthlyWageBasisCents')='integer' AND json_extract(booking.pricing_breakdown,'$.monthlyWageBasisCents')=COALESCE((SELECT json_extract(p.rules_json,'$.privateSecuritySector.monthlyMinimumWagesCents.areasOneAndTwo.gradeCDE') FROM payroll_policy_versions p WHERE p.id=json_extract(booking.pricing_breakdown,'$.payrollPolicyId')),700300) AND json_type(booking.pricing_breakdown,'$.payrollCostBasisCents')='integer' AND json_extract(booking.pricing_breakdown,'$.payrollCostBasisCents')=(CASE WHEN booking.engagement_model='fixed' THEN booking.officer_total_cents ELSE max(booking.officer_total_cents,CAST((booking.officer_total_cents*(10000+json_extract(booking.pricing_breakdown,'$.hourlyPremiumBasisPoints'))*max(720,json_extract(booking.pricing_breakdown,'$.hourlyMinimumShiftMinutes'))+7199999)/7200000 AS INTEGER),CAST((json_extract(booking.pricing_breakdown,'$.monthlyWageBasisCents')*(10000+json_extract(booking.pricing_breakdown,'$.hourlyPremiumBasisPoints'))*max(720,json_extract(booking.pricing_breakdown,'$.hourlyMinimumShiftMinutes'))*booking.shift_count+json_extract(booking.pricing_breakdown,'$.hourlyDivisor')*600000-1)/(json_extract(booking.pricing_breakdown,'$.hourlyDivisor')*600000) AS INTEGER)) END) AND (json_extract(booking.pricing_breakdown,'$.payrollPolicyId') IS NULL OR EXISTS(SELECT 1 FROM payroll_policy_versions p WHERE p.id=json_extract(booking.pricing_breakdown,'$.payrollPolicyId') AND p.policy_hash=json_extract(booking.pricing_breakdown,'$.payrollPolicyHash') AND p.environment='production' AND p.integrity_state='production_verified'))))
  AND booking.`service_day_count` >= 1
  AND booking.`headcount` >= 1
  AND booking.`shift_count` = booking.`service_day_count` * booking.`headcount` * booking.coverage_shifts
  AND booking.`officer_total_cents` > 0
  AND booking.`quote_subtotal_cents` > 0
  AND booking.`vat_rate_basis_points` = CASE WHEN booking.`pricing_version` IN ('LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment') THEN 0 ELSE 1500 END
  AND booking.`vat_cents` = CAST((booking.`quote_subtotal_cents` * booking.`vat_rate_basis_points` + 5000) / 10000 AS INTEGER)
  AND booking.`client_price_cents` = booking.`quote_subtotal_cents` + booking.`vat_cents`
  AND booking.`cost_floor_cents` > 0
  AND booking.`margin_cents` = booking.`quote_subtotal_cents` - booking.`cost_floor_cents`
  AND booking.`gross_platform_contribution_cents` = booking.`quote_subtotal_cents` - booking.`officer_total_cents`
  AND booking.`margin_basis_points` = CAST(booking.`margin_cents` * 10000 / booking.`quote_subtotal_cents` AS INTEGER)
  AND booking.`margin_basis_points` >= booking.`minimum_margin_basis_points`
  AND booking.`minimum_margin_basis_points` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 2500 WHEN 'armed_static' THEN 3000 WHEN 'armed_movement' THEN 3200
    WHEN 'vip_unarmed' THEN 3500 WHEN 'vip_armed' THEN 3700 WHEN 'vip_protective_driver' THEN 3600
    WHEN 'vip_team' THEN 3800 ELSE -1 END
  AND booking.`service_type` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 'Unarmed'
    WHEN 'armed_static' THEN 'Armed' WHEN 'armed_movement' THEN 'Armed'
    WHEN 'vip_unarmed' THEN 'VIP' WHEN 'vip_armed' THEN 'VIP'
    WHEN 'vip_protective_driver' THEN 'VIP' WHEN 'vip_team' THEN 'VIP' ELSE '' END
  AND json_valid(booking.`specialist_configuration`) = 1
  AND json_type(booking.`specialist_configuration`) = 'object'
  AND json_valid(booking.`pricing_breakdown`) = 1
  AND json_type(booking.`pricing_breakdown`) = 'object'
  AND CASE WHEN json_valid(booking.`specialist_configuration`) = 1 THEN
    json_type(booking.`specialist_configuration`,'$.serviceCode') = 'text'
    AND json_extract(booking.`specialist_configuration`,'$.serviceCode') = booking.`specialist_service_code`
    AND json_type(booking.`specialist_configuration`,'$.teamSize') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.teamSize') = booking.`headcount`
    AND json_type(booking.`specialist_configuration`,'$.travelKmPerServiceDay') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') BETWEEN 0 AND 1500
    AND json_type(booking.`specialist_configuration`,'$.planningHours') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.planningHours') BETWEEN
      CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 1
        WHEN 'armed_movement' THEN 2 WHEN 'vip_unarmed' THEN 2 WHEN 'vip_armed' THEN 3
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 4 ELSE 999 END AND 80
    AND json_type(booking.`specialist_configuration`,'$.overnightDays') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.overnightDays') BETWEEN 0 AND 60
    AND json_type(booking.`specialist_configuration`,'$.vehicleClass') = 'text'
    AND ((booking.`specialist_service_code` IN ('standard_unarmed','armed_static')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'none')
      OR (booking.`specialist_service_code` IN ('armed_movement','vip_protective_driver')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('client_vehicle','standard_suv'))
      OR (booking.`specialist_service_code` IN ('vip_unarmed','vip_armed','vip_team')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('none','client_vehicle','standard_suv')))
    AND booking.`headcount` BETWEEN
      CASE booking.`specialist_service_code` WHEN 'vip_team' THEN 2 ELSE 1 END
      AND CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 6 WHEN 'armed_static' THEN 6
        WHEN 'armed_movement' THEN 4 WHEN 'vip_unarmed' THEN 4 WHEN 'vip_armed' THEN 4
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 6 ELSE 0 END
    AND booking.`pricing_status` = CASE
      WHEN json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'armoured_partner'
        THEN 'partner_review_required' ELSE 'authoritative' END
    AND booking.`cost_floor_cents` = (CASE WHEN booking.pricing_version='LOKD-SPECIALIST-2026.11-v3-employment' THEN json_extract(booking.pricing_breakdown,'$.payrollCostBasisCents')+CAST((json_extract(booking.pricing_breakdown,'$.payrollCostBasisCents')*1150+9999)/10000 AS INTEGER) ELSE booking.`officer_total_cents`
      + CAST((booking.`officer_total_cents` * 1150 + 9999) / 10000 AS INTEGER) END)
      + booking.`shift_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 12000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 75000
        WHEN 'vip_unarmed' THEN 70000 WHEN 'vip_armed' THEN 120000
        WHEN 'vip_protective_driver' THEN 90000 WHEN 'vip_team' THEN 80000 ELSE -999999999 END
      + booking.`service_day_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 14000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 85000
        WHEN 'vip_unarmed' THEN 120000 WHEN 'vip_armed' THEN 150000
        WHEN 'vip_protective_driver' THEN 130000 WHEN 'vip_team' THEN 180000 ELSE -999999999 END
      + json_extract(booking.`specialist_configuration`,'$.planningHours') * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 65000 WHEN 'armed_movement' THEN 75000
        ELSE 95000 END
      + json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') * booking.`service_day_count` * 900
      + booking.`service_day_count` * CASE json_extract(booking.`specialist_configuration`,'$.vehicleClass')
        WHEN 'standard_suv' THEN 220000 ELSE 0 END
      + json_extract(booking.`specialist_configuration`,'$.overnightDays') * booking.`headcount` * 180000
    ELSE 0 END
  AND CASE WHEN json_valid(booking.`pricing_breakdown`) = 1 THEN
    json_type(booking.`pricing_breakdown`,'$.baseClientCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.calendarPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.dispatchPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.riskPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = 'integer'
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents')
      + json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.subtotalCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.vatCents') = booking.`vat_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.payrollBurdenCents')
      + json_extract(booking.`pricing_breakdown`,'$.readinessAndEquipmentCents')
      + json_extract(booking.`pricing_breakdown`,'$.commandAndSupervisionCents')
      + json_extract(booking.`pricing_breakdown`,'$.planningCents')
      + json_extract(booking.`pricing_breakdown`,'$.travelCents')
      + coalesce(json_extract(booking.`pricing_breakdown`,'$.vehicleCents'),json_extract(booking.`pricing_breakdown`,'$.vehicleAndPartnerCents'))
      + json_extract(booking.`pricing_breakdown`,'$.overnightCents')
      + booking.`officer_total_cents` = booking.`cost_floor_cents`
    ELSE 0 END
THEN 1 ELSE 0 END AS `valid`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat','LOKD-SPECIALIST-2026.11-v3-employment');
