# Retained tool/setup failures

These are concise excerpts/observations from the actual tool results, not regenerated command logs.

- Sandbox process startup failed with quota122 at /tmp/.git. Approved escalated local execution succeeded; repeated sandbox retries were avoided.
- `bash scripts/sites-env.sh -- tsc --noEmit --incremental false` exited127 with `scripts/sites-env.sh: line 52: exec: tsc: not found`. The wrapper does not add the project binary directory to PATH. Running the existing local TypeScript binary explicitly passed. The earlier type log path was reused; this note preserves the failure separately.
- Full lint initially reported3 unused `t` callback parameters in the new schema declarations. Parameters were removed without changing schema semantics. The original warning output is retained in final-integrated-lint.log; final-lint-clean.log is the later zero-warning result.
- First pagination browser run:34 passed,2 failed because a dynamic `.last()` locator changed from the original form to a newly hydrated second source. The corrected test scopes the original source and retains its full draft assertion. Original output retained in refund-pagination-browser-first.log. Later verification is separately recorded.
- Some independent nested Node test invocations returned no named child output. Reviewers required direct loader markers or an isolated child test context, not an empty wrapper summary. The successful root full regression retains named cases; reviewer reports describe their distinct invocations and limits.

- First full combined browser run:160 passed,10 failed. All40 finance adjustment cases passed. Older production-operations recovery fixtures returned an incomplete refund-page response, producing a second legitimate alert and failing strict existing alert assertions. The fixture contract is being corrected; assertions are retained. Original log:frontend-full-first.log. Final clean rerun is recorded separately.

Stored textual logs normalize trailing horizontal whitespace and surplus blank EOF lines for a clean versioned patch. Test content, failures, totals and timing values are unchanged. The first staged whitespace check identified CLI route-table padding and failure-report trailing spaces; only log formatting was normalized.
