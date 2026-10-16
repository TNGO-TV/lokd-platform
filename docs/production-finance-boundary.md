# Production finance records

The production Operations command entry and payment recovery endpoint reject test payment actions. Preparing collections or destinations requires live mode. Actions against existing collections, settlements, destinations and payment instructions check the immutable saved mode before calling the underlying workflow. A caller cannot relabel a saved test record with `mode: live`. Replacement instructions also require a live source and destination.

Production reads select live collections, settlement reviews, recovery events, destinations and employee/partner payment instructions and candidates. The corresponding controls also exclude test records before parsing their saved payloads. Live provider configuration, evidence, independent approval and release requirements remain mandatory. This change enables no provider flag and makes no payment.

Historical test records are retained. The lower-level finance helpers still support isolated fixtures and separately guarded test workflows; ordinary production callers enter through the checked production command boundary. The command and paged-refund boundaries require no data deletion. Finance document projections additionally require source migration 0085 before the corrected handlers are deployed.

Validation covers forged commands, test-mode saved references and replacements, the separate recovery endpoint, mixed live/test SQLite journeys, and actual rendered controls retaining live actions. Supported native CI is required before release; these tests alone are not launch approval.

Migration 0085 rebuilds three finance-document views. New document snapshots and current payment references use live rows only. Remittance sources and private historical access select the latest independently verified live representative; a later test destination cannot change that authority. A later verified live representative can supersede access under the existing policy. Existing immutable document, approval, issue and payment records are retained byte for byte. Historical snapshots containing test evidence remain visible as issued, with an explicit notice that they cannot establish a live payment.

Apply 0085 only as a separately authorized deployment prerequisite after backing up the database and validating the final candidate. Do not roll back to a handler or projection that mixes test destinations/payment rows into production documents. No live migration has been run during this work.

The production refund API rejects every mutation whose saved collection is test mode. Its five datasets filter live sources before pagination; cursors bind the chosen live/history boundary so a history cursor cannot be reused in production. Lower-level isolated fixtures retain access to test history.
