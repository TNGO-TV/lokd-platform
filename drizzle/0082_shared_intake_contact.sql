-- Contact numbers may be shared or recycled. Ownership is established through
-- verified account/email linking in signup_cases, never through a public phone.
-- Preserve every existing row and retain the index for operational lookup.
DROP INDEX officer_applications_mobile_idx;
--> statement-breakpoint
CREATE INDEX officer_applications_mobile_idx ON officer_applications(mobile_normalized);
