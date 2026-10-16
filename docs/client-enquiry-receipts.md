# Client enquiry receipts

Apply migrations through 0084 before deploying this intake handler. Live migration and deployment are separate release-authorized actions; neither is executed by this source change. Existing enquiry, signed agreement and audit records remain unchanged.

Every distinct submission is saved independently. Contact email, organisation and phone are not ownership credentials and never select an existing anonymous receipt. New references retain the complete UUID. The existing verified-email account-linking checks remain in force.

The public form generates a random UUID submission key. Identical retries reuse the original body and key. The server stores a hash of that key and the normalized payload, in the same atomic D1 batch as the enquiry and audit event. Concurrent exact retries recover one receipt; reusing a key for changed details returns a conflict without exposing the prior reference. Older clients without a key still create independent enquiries, but cannot recover a lost response idempotently.

A honeypot response contains no saved reference and makes no saved-record claim. The form displays success only for a saved:true receipt with a full enquiry UUID. Network failures, invalid success bodies and uncertain server responses retain the original body in this tab and offer Retry original enquiry. The form is locked until that outcome is recovered, preventing accidental replacement of an uncertain request. Closing the tab loses this in-memory retry key; do not claim cross-device recovery.

The new insert guard accepts the seven services already offered by the public form. All prelaunch/user-submitted, zero-credit, consent, retention, initial status and history protections remain. This intake is neither a booking nor a payment instruction and grants no deployment eligibility.
