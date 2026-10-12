# Browser tool availability — 22 September 2026

Task: 01a0c49f-ac8d-78e2-abca-48239538b448. Desktop user is on Windows; task execution is on the AmmoSync VPS. The user states browser control was approved previously. Do not request that approval again.

Read-only checks in this task:

- Running codex-cli version: 0.153.4.
- `codex features list` reports browser_use, browser_use_external, browser_use_full_cdp_access, computer_use, and in_app_browser all stable and true.
- User config has no explicit browser/computer feature overrides and no MCP server entries. No config was changed.
- Available tool catalog contains browser opening via codex_app__open_in_codex, but no browser inspection, navigation control, click, screenshot, evaluation, or computer-control tool. No tool-search mechanism is exposed.
- Directory search for browser/computer use found no relevant existing installed browser connection. Unrelated integrations were not suggested.
- Remote app-server log contained no browser/computer-use diagnostic lines. This does not establish the desktop bridge's health.
- User screenshot of @browser shows repository file/folder suggestions. The earlier @Browser setup instruction did not expose browser tools.

Conclusion: enabled feature configuration and missing task control tools are independently observed. Root cause remains unverified; do not claim permission denial, Windows incompatibility, or SSH incompatibility from this evidence alone. No tools exist here for restarting/reconnecting the desktop browser integration. Do not change security policy or extract browser cookies as a workaround.

Hosted test evidence: signed-in GET and POST /api/operational-delivery returned 200. POST request dcba837037aa6d70dd92538f185b1074, timestamp 1790089540902. Logs lack per-job result bodies. Latest authenticated CRM exact-reference lookup for ENQ-F5BAD219 returned no matches. Provider delivery is not verified, and no new dispatch was performed. Existing test allowlists remain narrow. Real transactions remain deferred.

Recovery requirement: restore supported browser-control tool exposure for this task, or provide an authenticated execution environment through the supported desktop workflow. Preserve the user's existing sign-in, approvals, source, and test record. This report is prepared for app diagnostics/support; it has not been sent externally.
