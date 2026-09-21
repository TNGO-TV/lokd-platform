# Operational integration setup and verification

21 September 2026. Preserve the v74 release, real-transaction deferral and accepted
manual security/release gate. This document supplements the original handover.

## Verified external evidence

`PROVIDER-EVIDENCE.json` records actual authenticated CRM reads and a controlled
synthetic lead insert/replay/search. Exactly one lead exists for
`LOKD-SYNTHETIC-20260921-CRM-01`, ID `7607722000000698001`. It is explicitly marked
NOT A CUSTOMER, has no email address, and has Email Opt Out set. The upsert requests
specify no workflow triggers and skip insert/update cadences. Keep the synthetic
record for evidence; it is not a customer, booking, invoice or payment.

CRM organisation: `7607722000000020005`, LOKD Security (Pty) Ltd, ZAR,
Africa/Johannesburg, Enterprise trial until 6 October 2026. One active administrator:
`accounts@lokd.co.za`, ID `7607722000000621001`. Owner explicitly selected this
address for team alerts and CRM assignment in this task.

A unique text field `LOKD_Enquiry_Reference` was added to Leads. CRM owns lead
follow-up. No Accounts/Contacts writer or invoice series was created. CRM standard
Quotes and Invoices modules do not establish Zoho Books integration. The generic
CRM connections list returned empty; this is not proof that native CRM–Books sync
is absent. No Books actions are exposed by either connected CRM link.

## Implemented boundary

- Migration 0075 atomically queues enquiry CRM/team notifications, prepared-order
  team notifications and issued-envelope emails. It does not backfill old records.
- The new durable queue is separate from the internal operator outbox and its
  integrity constraints. Job payload, recipient, source and provider reference
  cannot be rebound. Concurrent dispatch is leased; attempts are bounded to five.
- External work is **off by default** and requires exact source-reference and
  email-recipient allowlists. There is no general customer-broadcast mode.
- CRM runtime OAuth verifies the configured region and organisation before upsert;
  retries use the original enquiry reference and frozen request. Existing customer
  sync ownership is unaffected.
- Zoho ZeptoMail is the preferred email setup following owner steering. Its adapter
  freezes provider selection in each immutable request, sends only the secure link,
  and confirms delivery using authenticated email logs. A correlation reference is
  not treated as idempotency: unknown acceptance or a lost dispatch lease requires
  investigation, never automatic resending. The documented `.com` endpoint is
  implemented; other data centres must be verified before enabling them.
- The retained Resend adapter uses stable idempotency keys, stops retries after
  23 hours (provider retention is 24), and reports accepted separately from
  confirmed delivered/bounced/failed. Unknown outcomes are not blindly resent.
- Contract email resolves the named signer's current verified primary Clerk email,
  checks account status, rechecks approved wording, scope hash, intake binding,
  expiry, cancellation and withdrawal, and sends a private sign-in link only.
  Contract wording and identity evidence are never copied into email messages.
  Existing cross-account signing and activation guards remain in place.
- Operations intake and agreements show queue status. Explicit due-work processing
  and existing scheduled Worker dispatch share the same guarded runner. No new
  cloud schedule or unrestricted outbound switch was enabled.
- `/api/zoho-books` provides owner-only, read-only organisation/document comparison.
  It compares existing estimate/invoice ID, customer, order reference, ZAR total,
  tax and provider revision against the local order. It does not persist an approved
  link, create financial records, send invoices, record payment or fund service.

## Private runtime setup (no secrets in chat)

The assistant connector authorization is **not** runtime authorization. Hosted
revision 19 had no Zoho or email runtime configuration. Revision 20 now stores the
owner-selected team email, CRM organisation and assignee, with delivery explicitly
false. No secret or live gate was changed. The following names are
implemented; supply secrets only through the approved private hosted environment
or ignored local environment files used by a designated test runner.

| Setting | Required value / purpose |
| --- | --- |
| `LOKD_ZOHO_ACCOUNTS_ORIGIN` | Verified Zoho OAuth data-centre origin |
| `LOKD_ZOHO_API_ORIGIN` | Corresponding API origin returned by OAuth |
| `LOKD_ZOHO_CLIENT_ID` | Runtime OAuth application ID |
| `LOKD_ZOHO_CLIENT_SECRET` | Secret |
| `LOKD_ZOHO_REFRESH_TOKEN` | Secret; use least-privilege approved scopes |
| `LOKD_ZOHO_CRM_ORG_ID` | `7607722000000020005` |
| `LOKD_ZOHO_CRM_OWNER_ID` | `7607722000000621001` |
| `LOKD_ZOHO_BOOKS_ORG_ID` | Inspect the owner's existing Books organisation; currently unknown |
| `LOKD_TEAM_EMAIL` | `accounts@lokd.co.za` (owner selected) |
| `LOKD_EMAIL_PROVIDER` | `zeptomail`, only after domain and private setup verification |
| `LOKD_EMAIL_FROM` | Verified sender mailbox/address on the configured sending domain |
| `ZEPTOMAIL_SEND_TOKEN` | Private ZeptoMail Agent send token |
| `LOKD_ZEPTOMAIL_API_ORIGIN` | `https://api.zeptomail.com`, only if this is the account data centre |
| `RESEND_API_KEY` | Optional alternative only; not needed for ZeptoMail |
| `CLERK_SECRET_KEY` | Existing trusted account-directory lookup; never extract its value |
| `LOKD_OPERATIONAL_DELIVERY_ENABLED` | Keep absent/false until controlled setup is verified |
| `LOKD_DELIVERY_SOURCE_ALLOWLIST` | Comma-separated exact designated test source IDs |
| `LOKD_DELIVERY_EMAIL_ALLOWLIST` | Comma-separated designated recipient addresses |

Required CRM scopes cover organisation read and Leads create/update. Books needs
settings/organisation, estimates and invoices read scopes for the read-only check.
No Books write scopes are required by this implementation. Verify actual scope
names and data centre in the OAuth setup before granting access.

The owner requested guided setup. Next owner steps: open the LOKD Books company,
provide the browser URL and organisation ID (neither is a secret). For email, open
https://www.zoho.com/zeptomail/ with the existing Zoho account, choose Access
ZeptoMail, add `lokd.co.za`, and obtain the DKIM/return-path DNS records. Configure
the Agent and sender privately; do not paste its send token in chat. Email log
verification additionally needs `Zeptomail.email.READ` in the runtime OAuth grant.
Domain/account setup and actual sending are not yet established. A connected CRM
plugin does not configure ZeptoMail or prove its runtime authorization.

Before customer sync, inspect native Books–CRM integration and decide which system
creates customers. Before financial writes, bind the approved quote revision,
LOKD contract receipt, Books invoice and reconciliation under independent review.
Existing local financial documents are retained; do not issue a competing invoice
series or automatically interpret a Books paid status as settled LOKD funding.

## Remaining acceptance

1. Verify Books company ID, country, ZAR and actual native CRM sync; obtain private
   runtime OAuth with verified data-centre pairing.
2. Verify selected email domain and actual controlled send, delivery and bounce to
   the designated recipient. Source IDs must designate synthetic prerequisites.
3. Establish reviewed customer/quote/invoice mappings and source-of-truth policy
   before adding financial writes or automatic post-acceptance invoice creation.
4. Actual Paystack test checkout, provider-delivered signed webhook and matching
   verification are still absent. Hosted key-name presence is not acceptance.
   Enrolment remains test-only and combined finance remains deterministic; neither
   was silently enabled or replaced in this change.
5. Preserve separate collection/settlement review and all live gates. Real payments,
   identity submissions and physical-device tests remain deferred.

## Sources

- https://www.zoho.com/zeptomail/help/getting-started.html
- https://www.zoho.com/zeptomail/help/api/email-sending.html
- https://www.zoho.com/zeptomail/help/api/get-email-logs.html

- https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html
- https://www.zoho.com/crm/developer/docs/api/v8/refresh.html
- https://www.zoho.com/books/api/v3/organizations/
- https://www.zoho.com/books/api/v3/estimates/
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/api-reference/emails/retrieve-email
- https://resend.com/docs/dashboard/domains/introduction

## Reusable operational lesson

Observation: the previous task exposed no Zoho actions; this task exposes four
connector methods with 1,309 CRM operations. Action: discover once, read the actual
organisation and schema, then test one synthetic idempotent operation. Result:
connector/provider CRM acceptance is proven while runtime OAuth, Books and email
remain distinct. Lesson: do not repeat installation or infer deployed authorization
from a connected assistant. Next evaluation: actual private runtime and controlled
email/Books reads, retaining separate simulated/provider/deployed evidence.
