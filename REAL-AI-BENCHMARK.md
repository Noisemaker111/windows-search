# Real-file AI benchmark — 2026-09-07

**Do not release.** Real metadata tests exposed failures the synthetic scanner
tests did not: unhelpful literal interpretation, long result dumps, and fabricated
paths in otherwise successful model answers. No 100× product claim is supported.

## Prioritized findings

| Priority / evidence | Reproduction and observation | Impact / likely cause | Measurable release criterion |
| --- | --- | --- | --- |
| P0, verified, unresolved: invented path | Anonymous sample 4, partial Desktop filename, Luna low Normal. One of two answer-policy repeats and one of two final repeats omitted an actual subdirectory from a suggested path. The generated path was absent from tool evidence and did not exist when checked. | Correct clickable candidates coexist with a false textual location. A copy-exact instruction does not constrain generative path reconstruction. | Every displayed path must resolve to an evidence identity, including streamed text. Zero unsupported paths across at least 100 adversarial/repeated real and synthetic location journeys; missing evidence produces an honest error. A prompt alone is insufficient. |
| P1, verified, unresolved: broad retrieval and refinement | Samples 8, 16, 17 and 20 did not return the sampled target for either model in the baseline. Common names/folder clues yielded truncated candidate sets; sample 16 also hit the traversal budget. | The model cannot rank or select a target it never receives. An ambiguous parent clue cannot uniquely identify one file; this is a coverage measurement, not proof that every answer was wrong. | Narrowing or paging must reach all known fixture candidates without repeating the same prefix. Run at least 50 held-out real tasks, with success and time measured through up to two clarification turns; establish a product target before claiming superiority. |
| P1, verified: answer bloat; improved | Four problematic cases produced median answers of 1,881 characters on Haiku and 1,740 on Luna, often listing 20 paths. | The prompt explicitly requested every relevant path, duplicating the result list and increasing generation time. | At most three textual candidates, full clickable list retained, truncation acknowledged. Repeated runs now satisfy the three-path limit, but concision is still a model instruction rather than a hard bound. |
| P1, verified: incomplete names dismissed; improved | Haiku retrieved sample 4 but replied that no exact filename matched and supplied no full path. | The model interpreted a useful prefix as a mandatory exact name. | Partial-name journeys show verified candidate paths before clarification. Both follow-up and final Haiku repeats did so; fabricated Luna paths remain a separate failure. |
| P1, verified: narration contamination; fixed at stream boundary | One Haiku answer began with a leftover fragment of search narration after a tool-start event. | Text arriving while the discovery tool was running was appended to the final answer. | Suppress text while any discovery tool is active, release on success/failure, and preserve the final answer. Regression includes overlapping tools, foreign events and tool failure. |
| P1, verified, unresolved: latency variance | Baseline Luna completion reached 29.9s. A final short partial-name answer still took 25.6s. | Model/proxy and tool orchestration dominate many requests; scanner-only speed cannot explain total latency. | Repeated whole-journey p50/p95 measurements with a defined target, including cold start and outages. A practical proposed target is first useful candidate within 2s for scoped queries and answer p95 below 10s; current evidence fails it. |
| P1, untested: native daily use | Headless Edge checks do not exercise Win+S, Alt+Space, foreground focus, competing Windows Search or login startup. | Native automation remains unavailable in this runtime. | Physically complete the native journey matrix in RELEASE-AUDIT.md before release. |

## Method and baseline

The user explicitly authorized sending real sampled filenames and paths through
the existing subscription proxies. No file contents were read. Private queries,
targets and raw answers remain in ignored `.cache`; published records contain
anonymous sample numbers, root categories, measurements and counts only.

The baseline has 24 sequential submissions: 12 previously sampled real files,
four exact names, four incomplete names, four parent-folder/extension clues,
each tested with Haiku and Luna low Normal in alternating model order. Depths
range from 0 to 7 across six default roots. These are not held-out targets or
content-semantic tasks. The full target path was withheld from the prompt.
All queries used `answerPrompt` and the configured OpenCode agent/MCP path,
with fresh sessions, no prepared-session pool, and the production 50,000-entry /
2.5-second scan budget. The first run includes cold host/catalog work; later runs
share the warm isolated host. No forced tiny continuation budget was used.

| Baseline, 12 submissions/model | Haiku | Luna low Normal |
| --- | ---: | ---: |
| Sampled target returned by tools | 8/12 | 8/12 |
| Sampled target path present in answer | 7/12 | 8/12 |
| Median first text after last tool start | 5.90s | 8.85s |
| Median completion | 10.00s | 12.62s |
| Slowest completion | 19.36s | 29.90s |
| Median sum of scanner page times | 0.61s | 0.63s |

First text is a timing observation, not a judged first useful answer. The scanner
time excludes model thinking and tool transport; session/subscription/prompt
admission timings are separate in the records. The remainder combines model,
proxy and OpenCode/tool overhead and **must not be labeled pure model latency**.
We did not obtain provider-internal timing or actual account charges.

## Changes and matched repeats

The answer prompt now treats incomplete names/typos as clues, presents at most
three candidate paths before clarification, and acknowledges truncated results.
The full result list is unchanged. The stream now ignores narration while
discovery tools are active. OpenCode remains the brain; no local answer bypass,
new provider, Fast tier or model-default change was introduced.

Four problem cases were repeated twice per model after the prompt change
(16 submissions). The table compares those same four cases with their original
single run per model; it is a small stochastic before/after experiment.

| Matched metric | Haiku before → after | Luna before → after |
| --- | ---: | ---: |
| Median completion | 13.18s → 7.70s | 21.43s → 10.77s |
| Median first text | 5.92s → 5.60s | 10.31s → 8.21s |
| Median output tokens | 1,030 → 314 | 771.5 → 166 |
| Median input tokens | 6,328.5 → 6,578 | 4,969.5 → 5,217.5 |
| Median answer characters | 1,880.5 → 462 | 1,739.5 → 332.5 |

Output token medians fell about 70%/78%; input token medians increased about 4%/5%.
This is observed consumption, not a dollar saving or guaranteed speedup. Shorter
answers intentionally omit some sampled targets that remain in the visible list.
Mechanical target-in-answer scores therefore cannot be used alone to judge this
change. The shorter Luna answer invented one path; this improvement is not a
grounding qualification.

After the stream correction, samples 4 and 11 were repeated twice per model
(8 further submissions). All eight retrieved the sampled target; all eight
answers contained verified candidates, but one Luna answer also contained the
same unsupported path. Haiku median completion was 8.12s; Luna 12.49s, including
the 25.62s outlier. No narration fragment was observed in these final eight
answers. The regression proves the event-handling case, not every narration form.

## Browser, evidence and reproduction

Four live headless Edge journeys were run against the isolated candidate bar,
two before and two after the stream correction. Each located a real partial-name
target in the result list. Typing made zero model calls and no launch occurred.
These exercise the actual shim, prepared-session path and UI; they do not verify
native desktop focus or hotkeys. Timing evidence is in `real-browser-results.json`
and `real-browser-before-stream-results.json`.

Direct model evidence: `real-ai-results.json`, `real-ai-followup-results.json`,
`real-ai-final-results.json`, and aggregate `real-ai-summary.json`. The `review`
counts check backtick-delimited drive paths against hits/ancestor folders and
stat-check unsupported paths; this narrow review is not a complete path parser
or product guard. Raw answers were also inspected privately. It cannot establish
that every sentence or unquoted location is grounded.

To reproduce, first create the private sample with `bun run bench:discovery:local`.
Run a separate OpenCode host with this repository's runtime config and default
real roots, set `SEARCH_OPENCODE_URL` and `SEARCH_OPENCODE_LOG` to that owned host,
then explicitly set `SEARCH_BENCH_METADATA_CONSENT=1` before
`bun run bench:discovery:ai`. This command sends metadata externally; the local
benchmark does not. Optional `SEARCH_BENCH_SAMPLES` takes anonymous one-based
sample numbers, `SEARCH_BENCH_REPEATS` accepts 1–3, and `SEARCH_BENCH_OUTPUT` selects
an anonymous JSON report basename. Never commit `.cache` or publish raw responses.

The candidate was not installed, merged or deployed. Shared services and login
startup were left unchanged. Remaining work includes evidence-bound answer
rendering, useful clarification across submissions, ranking/paging, content-only
clues, broader roots and the physical Windows comparison. Neither zero API errors
nor the passing regression suites makes this a daily-use release.
