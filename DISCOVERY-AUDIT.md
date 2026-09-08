# PC discovery audit — 2026-09-07

Follow-up: [deep-search benchmark](DEEP-BENCHMARK.md) documents the current depth-20
default, continuation/recovery behavior and Windows Search index comparison.
The measurements and depth-6 behavior below describe the earlier candidate.

Recommendation: **do not release yet**. The bar can now investigate files it did
not know at startup. This is a tested improvement to a candidate branch, not a
claim about the installed bar. Native shortcut/focus, launch identity, login,
multiple-monitor/DPI and rollback gates in RELEASE-AUDIT.md remain open.

## Prioritized assessment

| Priority / evidence | Reproduction and observation | Impact and likely cause | Measurable acceptance / current status |
| --- | --- | --- | --- |
| P0 verified coverage defect | Submit exact names of 16 seeded existing files across Desktop, Documents, Downloads and Projects. Old local index found 0/16. | The startup index covers apps, games and shallow Projects; the agent was forbidden to investigate. | Find sampled files outside the startup index with actual tool results. New local search finds 15/16 by name, 16/16 with a folder keyword. A separate balanced sample finds 18/20 by name; all 20 are accessible after exact parent-folder narrowing. AI choosing that parent is NOT established by this local test. |
| P0 verified false search claim; initialization cause suspected | First cold Haiku deep-file request printed fake function-call text, claimed directories were searched, and emitted zero tool events. Warm retry used the actual tool. | A plausible answer can masquerade as PC retrieval. An initially absent MCP catalog is a likely trigger; installed host internals were not traced. | No submission before PC service readiness; outages fail before inference. Added gate before session creation/preparation. Three restarted-host probes used real tools and found the file. Need a larger cold/outage/recovery matrix and continued grounding checks before release. |
| P1 verified search-planning failure | Misspelled deep filename initially returned no match at depth 6, despite depthLimited > 0. Haiku also missed slides described by a parent folder. | Models stopped early or used overly restrictive AND keywords. | The five positive fixture cases must return the expected real paths for each supported model. Explicit keyword/depth retry instructions reached 5/5 for Haiku and Luna, including two duplicate paths. Sol/Grok discovery is untested. |
| P1 verified misleading completeness | A common filename returned 20 results while the sampled target was omitted; a completed scan did not report truncation. A broad Projects scan also hit its time budget. | Top-20 results and bounded traversal are mistaken for exhaustive coverage. | Every time/depth/access/root/result limit must be visible, and missing-item wording must remain scoped. Added truncation counts and keyboard-expandable per-search coverage. Haiku still sometimes concludes too strongly after a depth-limited miss: remains a quality blocker. |
| P1 verified stale cache defect | Discover a new file, delete it, then search/select it again. Initial discovery cache retained its path for five minutes. | The next prompt could treat a deleted path as current evidence. | Deleted discovered paths disappear before reuse; stale selection returns 409 without launching. Fixed and repeated through the actual browser/shim/OpenCode journey for Haiku and Luna. Startup app/game index still has its existing refresh interval. |
| P1 measured latency | Actual browser submission finding a new deep fixture: Haiku 3.97s final-answer first text / 4.85s complete; Luna 9.97s / 11.50s with two searches. | Repeated model turns dominate small fixture scans; PC discovery adds real work. | Report useful answer latency separately from search progress. Existing warm first-text target of 1.5s is not met. Do not advertise this as instant or as a measured model-only speedup. |
| P1 verified routing defect | Submit a bare filename or vague personal-file description without a find/where prefix. The shim attempted Bing retrieval before the model. | An index miss was treated as web intent, potentially distracting file discovery and transmitting the query unnecessarily. | These cases must reach PC discovery without web retrieval. Added conservative explicit-web/current-question routing and regression cases. This heuristic is not general intent understanding. |

## Implementation and boundaries

OpenCode receives one typed, read-only MCP tool, `search_files`. The shim still
supplies startup hits and launch receipts; OpenCode decides whether to search,
chooses keywords/root/depth, reads coverage and can investigate again. No model
call occurs during typing. Every deliberate submission retains the OpenCode path,
Haiku default and existing Luna/Sol/Grok subscription routes. No metered xai route,
new credential, direct model client or local canned-answer bypass was added.

The tool searches filename and parent-folder metadata. Defaults are Desktop,
Documents, Downloads, Projects, Pictures, Music and Videos below the user profile.
It excludes hidden entries, links/junctions, dependency/build directories and
AppData. It does not read document contents, OCR pictures, search arbitrary disks,
or automatically resolve redirected Known Folders/OneDrive/network roots.
`SEARCH_PC_ROOTS` can explicitly configure roots; no root-editing UI exists yet.

Each scan has a 50,000-entry / 2.5-second traversal budget, default depth 6, maximum
depth 20, and 20 returned matches. Filesystem operations already in progress can
finish beyond the traversal budget. Multiple searches cost additional scans and
model turns. Same-name files retain separate identities. Fuzzy results and
ambiguous exact names do not authorize an automatic launch; users select a row.

Discovered rows are cached for five minutes (at most 500), revalidated before
reuse, and remain selectable even when the original query was vague. Search
progress clears pre-tool narration instead of concatenating it with the answer.
The UI shows each scan's scope and limits independently of model prose.

## Benchmark evidence and limits

See [raw sanitized measurements](discovery-benchmark-results.json).

- First local sample: seeded selection of 8 shallow and 8 deep existing files,
  depths through 9, from 14,560 candidates. The global 25,000-entry sampling cap
  starved Pictures; this is a biased sample, not whole-PC recall.
- Second local sample: independent seed, 5,000-entry sampling cap per root,
  20 samples spanning six populated roots. Old index 0/20; discovery 18/20.
  The two omitted common names returned 20 other matches; exact parent scopes
  found both in 4ms each. Four Projects searches hit the traversal time budget.
- Live models: six synthetic cases per model before and after prompt/readiness
  fixes: shallow, deep, vague parent-folder intent, duplicates, typo and missing.
  Afterward, all 10 positive model/case pairs returned their target paths. Both
  missing cases used tools and returned no hits, but Haiku's wording and lack of
  depth retry failed the stricter honesty criterion. The JSON `found` field is a
  tool-result check, not an overall answer-quality score.
- Twelve after-change model runs completed in 5.0–12.9s. Fixture scan calls took
  5–12ms. Model/transport/OpenCode execution time is not separately attributable
  from this evidence. Earlier Haiku first-text measurements include pre-tool
  narration; use the browser measurements for useful final-answer timing.
- Three subsequent cold-host Haiku runs found the deep fixture via actual tools,
  completing in 7.2–8.2s. This is not a 20-cycle reliability qualification.
- Two actual headless Edge journeys created different files after the bar started.
  Both were discovered through real OpenCode/proxies; typing made zero model
  calls. Deleted paths were removed and stale selection returned 409. These are
  browser checks, not physical Win+S/Alt+Space or native launch verification.
- Two further bare-filename browser journeys, without a find/where prefix, also
  discovered fresh deep files: Haiku 5.33s first answer / 6.29s complete, Luna
  7.20s / 8.64s. Both used one search and passed deletion/stale-selection checks.

Model tests used isolated synthetic roots, never the real-file sample. Automatic
approval review rejected sending real filenames and returned paths to the external
subscription proxy without explicit metadata-transfer approval. The local scanner
benchmark completed independently. Private ground truth stays in ignored `.cache`;
the published artifact contains no sampled real filenames or paths. No file
contents were read. Token counts are observations, not account charges.

Reproduce the local benchmark with `bun run bench:discovery:local [seed]`. It
samples names only, writes private ground truth and an anonymous report under
`.cache`, and makes no AI/network requests. Real model fixtures require an isolated
OpenCode host using this runtime config, with `SEARCH_PC_ROOTS` restricted to fixture
directories. Never point a synthetic benchmark host at the normal profile roots.

Regression checks: 30 unit/integration tests, 11 headless browser tests, 11 fake-host
native lifecycle checks, native helper compilation, TypeScript and UI syntax.
Coverage includes cancellation, path escape/junction exclusion, Unicode, duplicate
identity, truncation, service readiness/outage, event attribution, no typing calls
and result selection. No installed startup, proxy or production host was changed.

Remaining release work: real-metadata model journeys with permission; root/drive
coverage and redirected folders; content-based search expectations; honest limited
misses across all models; bounded search latency on large trees; physical shortcuts,
focus restoration, native launch identity, login, DPI/monitors and rollback. The
three cold successes reduce concern but do not close the lifecycle gate.
