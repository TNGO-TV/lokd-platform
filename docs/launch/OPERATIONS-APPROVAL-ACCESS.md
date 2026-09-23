# Operations approval authority

The owner assigned final approval responsibility to operations@lokd.co.za. LOKD_OWNER_ACCESS_JSON is a separate server-managed JSON email array for this authority. It supplements, and never replaces, the legacy redacted LOKD_PILOT_ACCESS_JSON map. Ordinary LOKD_OPERATIONS_ACCESS_JSON membership continues to grant Operations only.

Owner authority uses the existing owner semantics. Verified primary email, correct workspace, configured MFA policy, business prerequisites and independent maker/checker decisions still apply. It does not link a client/officer entity, approve any documents, create an operator record, enable payments, or substitute for source evidence. Changing this array requires a production environment deployment. Removing a grant requires removing that identity from every applicable owner list.

An empty, malformed or non-array supplemental value grants no authority. Request bodies and public registration cannot set this value. Runtime assignment and actual signed-in hosted validation must be reported separately from isolated tests.
