-- Calendar-day Flex, explicit schedule selections and two independently staffed 12-hour shifts.
ALTER TABLE bookings ADD COLUMN coverage_shifts INTEGER NOT NULL DEFAULT 1 CHECK(coverage_shifts IN (1,2));
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN service_dates TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(service_dates) AND json_type(service_dates)='array');
--> statement-breakpoint
ALTER TABLE bookings ADD COLUMN include_public_holidays INTEGER NOT NULL DEFAULT 0 CHECK(include_public_holidays IN (0,1));
--> statement-breakpoint
DROP INDEX roster_slots_booking_post_date_position_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX roster_slots_booking_post_date_position_idx ON roster_slots(booking_id,post_id,service_date,starts_at,position_index);
--> statement-breakpoint
CREATE VIEW booking_selected_service_dates AS WITH RECURSIVE subject AS (SELECT id,start_date,end_date,roster_pattern,include_public_holidays FROM bookings WHERE model_version='LOKD-MODELS-2026.11.2'), days(booking_id,service_date) AS (
 SELECT id,start_date FROM subject UNION ALL SELECT d.booking_id,date(d.service_date,'+1 day') FROM days d JOIN subject b ON b.id=d.booking_id WHERE d.service_date<b.end_date AND d.service_date<date(b.start_date,'+370 days')
 ), years AS (SELECT *,CAST(substr(service_date,1,4) AS INTEGER) y FROM days), a AS (
 SELECT *,y%19 ea,CAST(y/100 AS INTEGER) eb,y%100 ec FROM years), b AS (
 SELECT *,CAST(eb/4 AS INTEGER) ed,eb%4 ee,CAST((eb+8)/25 AS INTEGER) ef FROM a), c AS (
 SELECT *,CAST((eb-ef+1)/3 AS INTEGER) eg,(19*ea+eb-ed-CAST((eb-ef+1)/3 AS INTEGER)+15)%30 eh,CAST(ec/4 AS INTEGER) ei,ec%4 ek FROM b), d AS (
 SELECT *,(32+2*ee+2*ei-eh-ek)%7 el FROM c), e AS (
 SELECT *,CAST((ea+11*eh+22*el)/451 AS INTEGER) em FROM d), easter AS (
 SELECT *,printf('%04d-%02d-%02d',y,CAST((eh+el-7*em+114)/31 AS INTEGER),(eh+el-7*em+114)%31+1) easter_sunday FROM e), holidays AS (
 SELECT *,CASE WHEN substr(service_date,6) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26')
 OR service_date IN (date(easter_sunday,'-2 days'),date(easter_sunday,'+1 day'))
 OR (strftime('%w',service_date)='1' AND substr(date(service_date,'-1 day'),6) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26')) THEN 1 ELSE 0 END is_public_holiday FROM easter), selected AS (
 SELECT h.booking_id,h.service_date,h.is_public_holiday FROM holidays h JOIN subject s ON s.id=h.booking_id WHERE
 s.roster_pattern='daily' OR (s.roster_pattern='weekdays' AND strftime('%w',h.service_date) BETWEEN '1' AND '5')
 OR (s.roster_pattern='monday_saturday' AND strftime('%w',h.service_date) BETWEEN '1' AND '6')
 OR (s.roster_pattern='saturdays' AND strftime('%w',h.service_date)='6')
 OR (s.roster_pattern='weekends' AND strftime('%w',h.service_date) IN ('0','6'))
 OR (h.is_public_holiday=1 AND (s.roster_pattern='public_holidays' OR s.include_public_holidays=1))
 ) SELECT * FROM selected;
--> statement-breakpoint
CREATE TRIGGER booking_calendar_model_insert AFTER INSERT ON bookings WHEN NEW.model_version='LOKD-MODELS-2026.11.2' BEGIN
 SELECT (CASE WHEN NOT COALESCE((NEW.engagement_model IN ('bolt','flex','fixed') AND NEW.duration_weeks=0 AND NEW.requested_at IS NOT NULL
 AND julianday(NEW.requested_at)<=julianday('now','+10 seconds') AND julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')>julianday(NEW.requested_at)
 AND NEW.roster_pattern IN ('daily','weekdays','monday_saturday','saturdays','weekends','public_holidays')
 AND NEW.coverage_shifts IN (1,2) AND (NEW.coverage_shifts=1 OR (NEW.shift_start>='06:00' AND NEW.shift_start<'18:00' AND NEW.shift_end='06:00'))
 AND json(NEW.service_dates)=(SELECT json_group_array(service_date) FROM (SELECT service_date FROM booking_selected_service_dates WHERE booking_id=NEW.id ORDER BY service_date))
 AND NEW.service_day_count=json_array_length(NEW.service_dates) AND NEW.service_day_count>0 AND NEW.shift_count=NEW.service_day_count*NEW.headcount*NEW.coverage_shifts
 AND ((NEW.engagement_model='bolt' AND NEW.contract_months=0 AND NEW.start_date=NEW.end_date AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')-julianday(NEW.requested_at))*86400000) AS INTEGER)<259200000)
 OR (NEW.engagement_model='flex' AND NEW.contract_months=0 AND substr(NEW.start_date,1,7)=substr(NEW.end_date,1,7) AND NEW.service_day_count>=7 AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.shift_start||':00','-2 hours')-julianday(NEW.requested_at))*86400000) AS INTEGER)>=259200000)
 OR (NEW.engagement_model='fixed' AND NEW.contract_months IN (3,6,12) AND NEW.end_date=date(NEW.start_date,'+'||NEW.contract_months||' months','-1 day')))),0)
 THEN RAISE(ABORT,'booking_calendar_schedule_invalid') END); END;
--> statement-breakpoint
CREATE TRIGGER booking_calendar_schedule_immutable BEFORE UPDATE ON bookings WHEN OLD.model_version='LOKD-MODELS-2026.11.2' AND (
 NEW.start_date IS NOT OLD.start_date OR NEW.end_date IS NOT OLD.end_date OR NEW.shift_start IS NOT OLD.shift_start OR NEW.shift_end IS NOT OLD.shift_end OR NEW.headcount IS NOT OLD.headcount OR NEW.engagement_model IS NOT OLD.engagement_model
 OR NEW.contract_months IS NOT OLD.contract_months OR NEW.roster_pattern IS NOT OLD.roster_pattern OR NEW.coverage_shifts IS NOT OLD.coverage_shifts OR NEW.include_public_holidays IS NOT OLD.include_public_holidays
 OR NEW.service_dates IS NOT OLD.service_dates OR NEW.service_day_count IS NOT OLD.service_day_count OR NEW.shift_count IS NOT OLD.shift_count)
 BEGIN SELECT RAISE(ABORT,'booking_calendar_schedule_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER roster_calendar_shift_guard BEFORE INSERT ON roster_slots WHEN EXISTS(SELECT 1 FROM bookings WHERE id=NEW.booking_id AND model_version='LOKD-MODELS-2026.11.2') BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM bookings b JOIN json_each(b.service_dates) d ON d.value=NEW.service_date WHERE b.id=NEW.booking_id AND NEW.position_index BETWEEN 1 AND b.headcount
 AND date(NEW.starts_at,'+2 hours')=NEW.service_date AND (strftime('%H:%M',NEW.starts_at,'+2 hours')=b.shift_start OR b.coverage_shifts=2 AND strftime('%H:%M',NEW.starts_at,'+2 hours')='18:00')
 AND julianday(NEW.ends_at)=julianday(NEW.service_date||'T'||CASE WHEN strftime('%H:%M',NEW.starts_at,'+2 hours')<'18:00' THEN '18:00:00' ELSE '06:00:00' END,'-2 hours',CASE WHEN strftime('%H:%M',NEW.starts_at,'+2 hours')<'18:00' THEN '+0 days' ELSE '+1 day' END))
 THEN RAISE(ABORT,'roster_calendar_shift_invalid') END); END;
--> statement-breakpoint
CREATE TRIGGER enquiry_calendar_model_insert BEFORE INSERT ON client_enquiries WHEN NEW.booking_model_version='LOKD-MODELS-2026.11.2' BEGIN SELECT (CASE WHEN NOT COALESCE((
 NEW.booking_model IN ('bolt','flex','fixed') AND json_extract(NEW.booking_details,'$.coverType')=NEW.booking_model AND json_extract(NEW.booking_details,'$.startDate')=NEW.start_date AND json_extract(NEW.booking_details,'$.endDate')=NEW.end_date
 AND json_extract(NEW.booking_details,'$.rosterPattern') IN ('daily','weekdays','monday_saturday','saturdays','weekends','public_holidays')
 AND json_extract(NEW.booking_details,'$.serviceDates')=(WITH RECURSIVE subject AS (SELECT NEW.id id,NEW.start_date start_date,NEW.end_date end_date,json_extract(NEW.booking_details,'$.rosterPattern') roster_pattern,json_extract(NEW.booking_details,'$.includePublicHolidays') include_public_holidays), days(booking_id,service_date) AS (
 SELECT id,start_date FROM subject UNION ALL SELECT d.booking_id,date(d.service_date,'+1 day') FROM days d JOIN subject b ON b.id=d.booking_id WHERE d.service_date<b.end_date AND d.service_date<date(b.start_date,'+370 days')
 ), years AS (SELECT *,CAST(substr(service_date,1,4) AS INTEGER) y FROM days), a AS (
 SELECT *,y%19 ea,CAST(y/100 AS INTEGER) eb,y%100 ec FROM years), b AS (
 SELECT *,CAST(eb/4 AS INTEGER) ed,eb%4 ee,CAST((eb+8)/25 AS INTEGER) ef FROM a), c AS (
 SELECT *,CAST((eb-ef+1)/3 AS INTEGER) eg,(19*ea+eb-ed-CAST((eb-ef+1)/3 AS INTEGER)+15)%30 eh,CAST(ec/4 AS INTEGER) ei,ec%4 ek FROM b), d AS (
 SELECT *,(32+2*ee+2*ei-eh-ek)%7 el FROM c), e AS (
 SELECT *,CAST((ea+11*eh+22*el)/451 AS INTEGER) em FROM d), easter AS (
 SELECT *,printf('%04d-%02d-%02d',y,CAST((eh+el-7*em+114)/31 AS INTEGER),(eh+el-7*em+114)%31+1) easter_sunday FROM e), holidays AS (
 SELECT *,CASE WHEN substr(service_date,6) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26')
 OR service_date IN (date(easter_sunday,'-2 days'),date(easter_sunday,'+1 day'))
 OR (strftime('%w',service_date)='1' AND substr(date(service_date,'-1 day'),6) IN ('01-01','03-21','04-27','05-01','06-16','08-09','09-24','12-16','12-25','12-26')) THEN 1 ELSE 0 END is_public_holiday FROM easter), selected AS (
 SELECT h.booking_id,h.service_date,h.is_public_holiday FROM holidays h JOIN subject s ON s.id=h.booking_id WHERE
 s.roster_pattern='daily' OR (s.roster_pattern='weekdays' AND strftime('%w',h.service_date) BETWEEN '1' AND '5')
 OR (s.roster_pattern='monday_saturday' AND strftime('%w',h.service_date) BETWEEN '1' AND '6')
 OR (s.roster_pattern='saturdays' AND strftime('%w',h.service_date)='6')
 OR (s.roster_pattern='weekends' AND strftime('%w',h.service_date) IN ('0','6'))
 OR (h.is_public_holiday=1 AND (s.roster_pattern='public_holidays' OR s.include_public_holidays=1))
 ) SELECT json_group_array(service_date) FROM (SELECT service_date FROM selected ORDER BY service_date))
 AND json_extract(NEW.booking_details,'$.coverageShifts')=CASE json_extract(NEW.booking_details,'$.shift') WHEN 'both' THEN 2 WHEN 'day' THEN 1 WHEN 'night' THEN 1 END
 AND ((NEW.booking_model='bolt' AND json_extract(NEW.booking_details,'$.term')='single' AND NEW.start_date=NEW.end_date AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)<259200000 AND julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours','+12 hours')>julianday(NEW.created_at))
 OR (NEW.booking_model='flex' AND json_extract(NEW.booking_details,'$.term')='calendar_month' AND substr(NEW.start_date,1,7)=substr(NEW.end_date,1,7) AND json_array_length(NEW.booking_details,'$.serviceDates')>=7 AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)>=259200000)
 OR (NEW.booking_model='fixed' AND json_extract(NEW.booking_details,'$.term') IN ('3','6','12') AND NEW.end_date=date(NEW.start_date,'+'||json_extract(NEW.booking_details,'$.term')||' months','-1 day')))),0) THEN RAISE(ABORT,'enquiry_calendar_schedule_invalid') END); END;
--> statement-breakpoint
DROP VIEW client_quote_sources;
--> statement-breakpoint
CREATE VIEW client_quote_sources AS WITH original AS (SELECT b.id AS order_id,b.client_id,l.owner_user_id,b.contracting_entity_id AS entity_id,l.case_version,b.agreement_version AS order_version,
 json_patch(json_patch(json_object('orderId',b.id,'orderVersion',b.agreement_version,'clientId',c.id,'clientName',c.organisation_name,
 'contactName',c.contact_name,'contactEmail',c.contact_email,'ownerUserId',l.owner_user_id,'caseVersion',l.case_version,
 'contractingEntityId',b.contracting_entity_id,'siteName',b.site_name,'siteArea',b.site_area,'address',s.address_label,
 'postName',b.post_name,'instructions',post.post_orders_content
 ),json_object('serviceType',b.service_type,'purposeLabel',b.purpose_label,'purposeCode',b.purpose_code,
 'startDate',b.start_date,'endDate',b.end_date,'shiftStart',b.shift_start,'shiftEnd',b.shift_end,
 'headcount',b.headcount,'rosterPattern',b.roster_pattern,'shiftCount',b.shift_count,'serviceDayCount',b.service_day_count,
 'contractMonths',b.contract_months,'engagementModel',b.engagement_model,'riskBand',b.risk_band
 )),json_object('minimumGrade',b.minimum_grade,'specialistServiceCode',b.specialist_service_code,'declaredSiteRisk',json_extract(p.request_json,'$.quoteRequest.riskInput'),'specialistConfiguration',b.specialist_configuration,'subtotalCents',b.quote_subtotal_cents,'vatCents',b.vat_cents,
 'totalCents',b.client_price_cents,'currency','ZAR','pricingVersion',b.pricing_version,
 'fundingModel',b.funding_model,'creditTermsDays',b.credit_terms_days,'releaseCadence',b.release_cadence)) AS source_json
FROM bookings b JOIN production_order_setups p ON p.id=b.id
JOIN clients c ON c.id=b.client_id
JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id AND l.case_version=p.case_version
JOIN signup_cases a ON a.kind='client' AND a.source_id=l.case_id AND a.version=l.case_version AND a.owner_user_id=l.owner_user_id AND a.status='reviewed'
JOIN operational_sites s ON s.booking_id=b.id AND s.id='SITE-'||b.id
JOIN site_posts post ON post.booking_id=b.id AND post.id='POST-'||b.id
WHERE b.environment='production' AND b.integrity_state='production_verified' AND b.status NOT IN ('cancelled','completed')
AND c.environment='production' AND c.integrity_state='production_verified' AND c.approval_status='approved') SELECT z.order_id,z.client_id,z.owner_user_id,z.entity_id,z.case_version,z.order_version,CASE WHEN b.model_version='LOKD-MODELS-2026.11.2' THEN json_set(z.source_json,'$.bookingModelVersion',b.model_version,'$.requestedAt',b.requested_at,'$.coverageShifts',b.coverage_shifts,'$.serviceDates',json(b.service_dates),'$.includePublicHolidays',json(CASE b.include_public_holidays WHEN 1 THEN 'true' ELSE 'false' END)) WHEN b.model_version='LOKD-MODELS-2026.11' THEN json_set(z.source_json,'$.bookingModelVersion',b.model_version,'$.durationWeeks',b.duration_weeks,'$.requestedAt',b.requested_at) ELSE z.source_json END AS source_json FROM original z JOIN bookings b ON b.id=z.order_id;
--> statement-breakpoint
DROP VIEW specialist_pricing_validation_v33;
--> statement-breakpoint
CREATE VIEW `specialist_pricing_validation_v33` AS
SELECT booking.`id`,
CASE WHEN
  booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
  AND booking.`service_day_count` >= 1
  AND booking.`headcount` >= 1
  AND booking.`shift_count` = booking.`service_day_count` * booking.`headcount` * booking.coverage_shifts
  AND booking.`officer_total_cents` > 0
  AND booking.`quote_subtotal_cents` > 0
  AND booking.`vat_rate_basis_points` = CASE WHEN booking.`pricing_version` = 'LOKD-SPECIALIST-2026.09-v2-no-vat' THEN 0 ELSE 1500 END
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
    AND booking.`cost_floor_cents` = booking.`officer_total_cents`
      + CAST((booking.`officer_total_cents` * 1150 + 9999) / 10000 AS INTEGER)
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
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');

--> statement-breakpoint
CREATE TRIGGER roster_calendar_shift_update_guard BEFORE UPDATE OF booking_id,service_date,starts_at,ends_at,position_index ON roster_slots WHEN EXISTS(SELECT 1 FROM bookings WHERE id=NEW.booking_id AND model_version='LOKD-MODELS-2026.11.2') BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM bookings b JOIN json_each(b.service_dates) d ON d.value=NEW.service_date WHERE b.id=NEW.booking_id AND NEW.position_index BETWEEN 1 AND b.headcount
 AND date(NEW.starts_at,'+2 hours')=NEW.service_date AND (strftime('%H:%M',NEW.starts_at,'+2 hours')=b.shift_start OR b.coverage_shifts=2 AND strftime('%H:%M',NEW.starts_at,'+2 hours')='18:00')
 AND julianday(NEW.ends_at)=julianday(NEW.service_date||'T'||CASE WHEN strftime('%H:%M',NEW.starts_at,'+2 hours')<'18:00' THEN '18:00:00' ELSE '06:00:00' END,'-2 hours',CASE WHEN strftime('%H:%M',NEW.starts_at,'+2 hours')<'18:00' THEN '+0 days' ELSE '+1 day' END))
 THEN RAISE(ABORT,'roster_calendar_shift_invalid') END); END;

--> statement-breakpoint
DROP TRIGGER enquiry_product_model_insert;
--> statement-breakpoint
CREATE TRIGGER enquiry_product_model_insert BEFORE INSERT ON client_enquiries WHEN NEW.booking_model IS NOT NULL AND NEW.booking_model_version IS NOT 'LOKD-MODELS-2026.11.2' BEGIN
 SELECT (CASE WHEN NEW.booking_model_version IS NOT 'LOKD-MODELS-2026.11' OR json_extract(NEW.booking_details,'$.coverType') IS NOT NEW.booking_model OR json_extract(NEW.booking_details,'$.startDate') IS NOT NEW.start_date OR NEW.engagement_model IS NOT CASE NEW.booking_model WHEN 'fixed' THEN 'fixed' ELSE 'flex' END
 OR NOT ((NEW.booking_model='bolt' AND json_extract(NEW.booking_details,'$.term')='single' AND NEW.start_date=NEW.end_date AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)< 259200000 AND julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours','+12 hours')>julianday(NEW.created_at))
 OR (NEW.booking_model='flex' AND json_extract(NEW.booking_details,'$.term')='week' AND json_type(NEW.booking_details,'$.durationWeeks')='integer' AND json_extract(NEW.booking_details,'$.durationWeeks') BETWEEN 1 AND 52 AND NEW.end_date=date(NEW.start_date,'+'||(json_extract(NEW.booking_details,'$.durationWeeks')*7-1)||' days') AND CAST(ROUND((julianday(NEW.start_date||'T'||NEW.start_time||':00','-2 hours')-julianday(NEW.created_at))*86400000) AS INTEGER)>= 259200000)
 OR (NEW.booking_model='fixed' AND json_extract(NEW.booking_details,'$.term') IN ('3','6','12') AND NEW.end_date=date(NEW.start_date,'+'||json_extract(NEW.booking_details,'$.term')||' months','-1 day')))
 THEN RAISE(ABORT,'enquiry_product_model_invalid') END);
END;
