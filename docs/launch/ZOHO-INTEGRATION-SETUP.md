# LOKD Zoho integration setup

## Confirmed decision — 21 September 2026

The owner selected Zoho CRM and Zoho Books, created both accounts, and confirmed
that the new LOKD Books organisation uses South Africa and ZAR. These are
owner-confirmed settings, not yet independently verified through Zoho.
Clients must receive an email link to review and accept their contract in LOKD.
Existing real-payment and genuine identity/device testing deferrals remain.

## Connection evidence

The Zoho CRM connector was installed after the suggestion. The app reported it
connected, and a fresh directory check confirmed `installed: true`. However, the
current callable tool catalog contains no Zoho methods or tool-search facility,
so an authenticated organisation read could not be attempted in this turn.
Do not repeat installation or treat this as an owner account-setup failure.
This does not establish Books access or a deployed LOKD-to-Zoho connection.
Follow-up diagnostics: local Zoho plugin version 2.0.0 is present and its
`.app.json` references the expected required Zoho app. The local config has no
Zoho-specific plugin/app override. The callable catalog still exposes zero Zoho
methods, so no Zoho API request or authentication-error response has occurred.
The cause remains unconfirmed; inspect the app's visible connection status next.
Do not claim that reopening the task is a verified fix or that the owner's Zoho
setup is at fault. Official troubleshooting distinguishes missing tool discovery
from API authentication errors:
https://developers.openai.com/plugins/deploy/troubleshooting
The inspected `app/lib/finance-workflow-provider.ts` provides a deterministic
finance simulator, not a Zoho accounting adapter. Application code and deployed
configuration were not changed during this setup discovery.

Next step: when the Zoho methods are exposed to the task, inspect the
organisation, edition, current modules/fields, users and existing
Books integration before modifying configuration. Books organisation ID, data
centre and API authorization must be verified separately. Do not infer the data
centre from South Africa or ask the owner to paste OAuth secrets into chat.

## Proposed record ownership and mapping

| Stage | Authoritative record | Required correlation |
| --- | --- | --- |
| Booking enquiry | LOKD enquiry; CRM owns sales follow-up | Stable LOKD enquiry ID on CRM record; CRM record ID retained in LOKD |
| Qualified opportunity | CRM deal and assigned team member | LOKD enquiry/client reference; no duplicate opportunity on retry |
| Quote | Books quote | Books organisation, customer, quote ID and approved revision linked to LOKD order |
| Contract | LOKD approved document and signing envelope | Exact document/context hashes and named signer; Books quote reference |
| Invoice | Books invoice | One invoice source; immutable link to approved order and quote |
| Payment | Provider evidence, reconciled in Books | Original provider reference, gross amount, currency, fees and settlement references |
| Delivery | Durable notification task and provider delivery evidence | Booking/envelope ID, recipient, attempt and provider message ID |

Use Books financial records rather than creating a second independent invoice
series in CRM. Decide whether native CRM–Books sync or LOKD owns customer creation
after inspecting the installed configuration; never enable two competing writers.
CRM stage changes alone must not activate services or mark an order funded.
Creating a signing envelope is not evidence that its email was delivered.

## Acceptance scenario to implement and execute

1. A synthetic enquiry creates exactly one CRM work item with a visible owner.
2. Replaying the same event does not create another client or opportunity.
3. A reviewed quote maps to the correct Books organisation/customer and LOKD order.
4. Contract email opens the matching LOKD agreement after sign-in; another account
   cannot view or sign it. Revised or withdrawn contracts cannot be accepted.
5. Acceptance creates or links the intended invoice once, under the chosen policy.
6. Provider test evidence is reconciled without claiming a real payment or funding.
7. Expired authorization, provider timeout, duplicate callbacks and email bounces
   are visible and recoverable without duplicate records or duplicate sends.

Prefer provider sandbox/test facilities. A fresh Books organisation is not itself
a sandbox. Confirm a safe test destination before creating financial documents or
enabling email automation. No customer emails or financial records were created
in this discovery step.

## Sources and reusable lesson

- https://www.zoho.com/us/books/help/integrations/crm-integration.html
- https://www.zoho.com/books/api/v3/introduction/
- https://www.zoho.com/books/api/v3/organizations/

Observation: account creation was confirmed, but authenticated access was absent.
Action: searched the connector directory and offered the matching CRM connector.
Result: installation is confirmed, but the callable catalog has not exposed Zoho
methods; no organisation read or integration success has been claimed.
Lesson: distinguish account creation, installation, usable assistant access, native
CRM–Books sync, and the deployed application's OAuth connection. The next
evaluation is an authenticated read of the selected LOKD organisation and edition.
