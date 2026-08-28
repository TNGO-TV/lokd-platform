CREATE TRIGGER `production_roster_service_date_insert_guard_v1`
BEFORE INSERT ON `roster_slots`
WHEN NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'
  AND (date(NEW.`starts_at`) IS NULL OR NEW.`service_date` <> date(NEW.`starts_at`, '+2 hours'))
BEGIN
	SELECT RAISE(ABORT, 'production_roster_service_date_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `production_roster_service_date_update_guard_v1`
BEFORE UPDATE OF `service_date`,`starts_at`,`environment`,`integrity_state` ON `roster_slots`
WHEN NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'
  AND (date(NEW.`starts_at`) IS NULL OR NEW.`service_date` <> date(NEW.`starts_at`, '+2 hours'))
BEGIN
	SELECT RAISE(ABORT, 'production_roster_service_date_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_authoritative_calendar_wage_v1`
BEFORE INSERT ON `assignment_activation_snapshots`
WHEN NEW.`environment` = 'production'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		WITH source AS (
			SELECT rs.`service_date`, date(rs.`starts_at`, '+2 hours') AS derived_service_date,
				CAST(strftime('%Y', date(rs.`starts_at`, '+2 hours')) AS INTEGER) AS y,
				b.`pricing_version`, b.`calendar_category` AS stored_calendar_category,
				b.`officer_rate_cents` AS stored_officer_offer_cents, b.`service_type`,
				b.`engagement_model`, sra.`risk_band`
			FROM `assignment_activation_commands` command
			JOIN `roster_slots` rs ON rs.`id` = command.`roster_slot_id`
			JOIN `bookings` b ON b.`id` = rs.`booking_id`
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
				CASE service_type WHEN 'Unarmed' THEN 80000 WHEN 'Armed' THEN 200000 WHEN 'VIP' THEN 450000 END AS base_wage_cents,
				CASE risk_band WHEN 'Standard' THEN 1.0 WHEN 'Enhanced' THEN 1.0 WHEN 'Elevated' THEN 1.05
					WHEN 'High' THEN 1.1 WHEN 'Critical' THEN 1.2 END AS risk_multiplier,
				CASE authoritative_calendar_category
					WHEN 'ordinary' THEN 1.0
					WHEN 'sunday' THEN CASE engagement_model WHEN 'flex' THEN 2.0 WHEN 'fixed' THEN 1.5 END
					WHEN 'public_holiday' THEN 2.0 WHEN 'easter' THEN 2.25 WHEN 'christmas' THEN 2.5
				END AS calendar_multiplier
			FROM classified
		)
		SELECT 1 FROM priced
		WHERE service_date = derived_service_date
			AND pricing_version = 'LOKD-PREMIUM-2026.09'
			AND engagement_model IN ('fixed','flex')
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
