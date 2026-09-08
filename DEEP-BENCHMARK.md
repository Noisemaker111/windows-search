# Deep search benchmark — 2026-09-07

The goal is much more useful PC search. **100× better is not established. Do not
release yet.** This update measures retrieval, agent decisions and browser journeys
separately. It does not turn a synthetic scanner score into an overall product score.

Follow-up: [real-file AI benchmark](REAL-AI-BENCHMARK.md) records 48 authorized
real-metadata model submissions and four live browser journeys, answer-policy and
stream fixes, and a reproduced fabricated-path release blocker.

## Comparisons

| Boundary measured | Before | Current evidence |
| --- | --- | --- |
| Windows Search index, same 20 real files and root scopes, exact filename, top 20 | 11/20 targets returned; 8–72ms per query | Current recursive scanner returns 18/20 by filename. These are backend comparisons, not Win+S task completion. |
| 100 synthetic local retrieval cases | 60/100 | 100/100, including misspelled parent folders and resumable traversal. No model calls in this score. |
| Four live model cases with a forced 12-entry scan budget | Initial tool integration: 2/4 targets found; both vague cases failed | Later run: 4/4 found. Small stochastic samples, not a reliability qualification; one Luna run took 23 seconds. |
| Actual browser, new deep files created after startup, final default depth 20 | Earlier non-continuation browser data is in DISCOVERY-AUDIT.md | Haiku 8.79s final-answer first text / 9.68s complete; Luna 9.44s / 10.81s. Two searches each; zero typing calls; deleted results rejected. |

Windows baseline uses the documented
[Windows Search SQL/OLE DB interface](https://learn.microsoft.com/en-us/windows/win32/search/using-sql-and-aqs-to-query-the-index).
It queries the existing index without modifying its settings or adding fixtures.
It supplies the same root clue as our scanner. Ordering is the provider's default;
this is not a recreation of Windows UI ranking or Explorer's unindexed fallback.
The previous app's 0/20 startup-index result is **not** Windows Search's result.

## What changed

- `search_files` now defaults to depth 20 within the same 2.5-second / 50,000-entry
  traversal budget. A caller can still request a shallower search.
- A limited scan returns a single-use continuation token. OpenCode can call the
  typed `continue_file_search` tool to advance through unchecked entries. It keeps
  its existing brain and subscription routes; the shim does not write an answer.
- Continuations expire after one minute, with at most four pending scans. Timeout
  pruning, cancellation and shutdown release them. Directory containment is checked
  again after a pause, including a regression for replacement by an outside junction.
- Fuzzy matching includes parent-folder words. It remains a suggestion and does not
  authorize a guessed launch.
- Empty partial scans no longer stream a conclusive miss. If the agent stops with
  an outstanding cursor and no hits, the shim requests one continuation repair in
  the same OpenCode session. If still incomplete, it reports that explicitly.
  This can add model time and tokens. The normal submission deadline still applies.
  `investigationRepairs` and total token usage are returned with timing evidence.

The recovery guard is narrow: it protects empty partial pages with outstanding
cursors. It does not prove every sentence is grounded, nor fix unrelated hits,
content understanding, depth-limited misses explicitly requested below depth 20,
or all possible model mistakes. The final two browser journeys needed no repair;
the forced repair and stubborn-agent paths are covered by regression tests.

## The 100 cases

| Cases | Before | After | Purpose |
| --- | --- | --- | --- |
| 30 exact names at varied depths | 30 | 30 | Preserve existing recall |
| 30 transposed parent-folder clues | 0 | 30 | Find a generically named file using a misspelled folder clue |
| 10 duplicate-path cases | 10 | 10 | Preserve distinct identities and prevent ambiguous launch |
| 10 wrong-extension cases | 10 | 10 | Avoid false matches |
| 10 genuinely missing cases | 10 | 10 | Keep negatives negative |
| 10 traversal-budget cases | 0 | 10 | Continue beyond the already scanned prefix |

These controlled fixtures are regression targets, not a held-out user study.
Continuation cases use a deliberately tiny 10-entry budget. The harness may consume
up to 100 pages; the old implementation retries the same prefix three times. That
demonstrates progress, not equal-cost agent performance. Real models still have
bounded steps and must select useful roots/keywords. The raw records include calls
and elapsed times so this difference is visible.

## Reproduce and inspect

Run `bun run bench:discovery:deep` for the current 100-case local suite. It writes
only synthetic fixtures and its report under ignored `.cache`. The real-file sample
is produced by `bun run bench:discovery:local`; then run
`powershell.exe -NoProfile -File bench-windows-index.ps1` from this repository to
query Windows Search against that same private sample. Both are local metadata-only
benchmarks. Neither sends sampled names to an AI or reads file contents.

Raw evidence: `deep-discovery-results.json`, `windows-index-baseline.json`,
`real-continuation-results.json`, `model-continuation-before.json`,
`model-continuation-prompt-only.json`, `model-continuation-results.json`, and
`browser-continuation-results.json`. The live-model tests use synthetic roots and a
12-entry budget through `SEARCH_SCAN_ENTRIES`; the production default remains 50,000.
Token usage is observed consumption, not actual account charges.

The balanced real-file sample still finds 18/20 with up to three pages. One miss
is truncated among common filenames; the other needs a more specific parent scope.
Finding both with known parent paths does not establish that an AI can infer those
paths from an ordinary vague request. Windows was much faster on indexed files.

## Remaining release work

Run a held-out end-to-end task set against actual Windows Search: success without
knowing the filename, time to a useful result, false absence/launch rates, clicks,
correct app identity, recovery and token usage. Randomize order and repeat tasks;
include real shallow/deep files, duplicates, vague descriptions, missing items,
content-only clues, redirected roots, drives, outages and cancellation.

Native automation cannot currently run: the computer-use plugin requires a supported
`node_repl` with `@oai/sky`, which is not exposed, while native CUA is disabled.
Runtime repair must expose that supported entry point, verify a read-only window
listing, and resume Win+S/Alt+Space testing without replacing shared services.

The user subsequently authorized real filename/path transfer; those tests are now
recorded in REAL-AI-BENCHMARK.md. Content/OCR search, broader drive coverage, physical focus
and shortcuts, launch verification, login and rollback remain unqualified. This PR
does not install the candidate, change startup, merge, or deploy anything.
