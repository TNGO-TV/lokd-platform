CREATE TRIGGER client_agreement_signed_notice AFTER INSERT ON agreement_acceptance_receipts
WHEN EXISTS(SELECT 1 FROM production_signing_envelopes e WHERE NEW.id='LIVE-SIGN-'||e.id
 AND e.case_kind='client' AND e.role IN ('CLIENT_MSA','SERVICE_ORDER'))
BEGIN
 INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at)
 SELECT 'agreement:signed:'||e.id,'client',e.owner_user_id,'client_agreement_signed','client_agreement',e.id,
 json_object('receiptHash',NEW.receipt_hash,'documentId',e.document_id,'contextHash',e.context_hash),json_extract(NEW.receipt_json,'$.acceptedAt')
 FROM production_signing_envelopes e WHERE NEW.id='LIVE-SIGN-'||e.id;
 INSERT INTO client_notification_jobs(id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
 SELECT 'agreement:accepted:client:'||e.id,e.id,e.owner_user_id,'client','Your LOKD agreement is signed',
 'LOKD Security'||char(10)||char(10)||'Your signature has been recorded. Sign in to view your signed agreement and service details.'||char(10)||char(10)||
 'https://portal.lokd.co.za/client/agreements/'||e.id||char(10)||char(10)||'LOKD Security',
 json_extract(NEW.receipt_json,'$.acceptedAt'),json_extract(NEW.receipt_json,'$.acceptedAt'),json_extract(NEW.receipt_json,'$.acceptedAt')
 FROM production_signing_envelopes e WHERE NEW.id='LIVE-SIGN-'||e.id;
 INSERT INTO client_notification_jobs(id,source_id,owner_user_id,recipient_type,subject,message_text,next_attempt_at,created_at,updated_at)
 SELECT 'agreement:accepted:operations:'||e.id,e.id,e.owner_user_id,'operations','LOKD client agreement signed',
 'LOKD Security'||char(10)||char(10)||'The client has signed agreement '||e.id||'. Open Operations to review the service booking.'||char(10)||char(10)||
 'https://operations.lokd.co.za/ops/agreements/'||e.id||char(10)||char(10)||'LOKD Security',
 json_extract(NEW.receipt_json,'$.acceptedAt'),json_extract(NEW.receipt_json,'$.acceptedAt'),json_extract(NEW.receipt_json,'$.acceptedAt')
 FROM production_signing_envelopes e WHERE NEW.id='LIVE-SIGN-'||e.id;
END;
