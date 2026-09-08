# Windows Search

Standalone application repository: https://github.com/Noisemaker111/windows-search. OpenCode v2 is the runtime brain; this application is not an OpenCode configuration plugin.

**Experimental — do not release for daily use.** See [RELEASE-AUDIT.md](RELEASE-AUDIT.md) for verified defects, measurements, acceptance criteria and remaining release blockers. The native shortcut/focus lifecycle is not verified, and the new native dismissal/focus implementation still requires physical acceptance testing.

The loopback shim indexes Steam libraries, Start-menu shortcuts/Get-StartApps, and immediate Projects contents. It is not a full-disk or recursive file search. Every deliberate submission uses the installed OpenCode v2 host. Haiku is the default through CLIProxyAPI; Luna/Sol use the same subscription proxy and Grok uses the existing SuperGrok proxy. No metered xai route is allowed.

Typing, paste, local suggestions, example buttons, and model changes never submit to AI. Local lookup has a 40ms debounce. Enter/Ask submits; selecting a result with mouse or arrows/Enter requests its launch and submits through the same OpenCode path. Repeated Enter while pending is suppressed; a fresh submission after completion can retry. Editing, Stop, and Escape cancel the answer. Only exact normalized app/game names or explicit commands naming an exact result can auto-launch. Prefixes, acronyms and fuzzy suggestions require selection.

Launch receipts mean Windows accepted the dispatch request; they do not prove the intended application opened. Removed disk targets, including Steam installation paths, fail before dispatch. Broken shortcuts and packaged-app/protocol failures remain native verification work.

For eligible general queries with no local matches, the existing Bing RSS retrieval is filtered for obvious irrelevance. Source chips identify snippets, not full-page verification. Current facts without relevant evidence must be reported as unverifiable. The relevance heuristic and existing local/web routing are limited; reliable web answering is still a release blocker. The model cannot call tools or invent locations.

From this package directory:

- `bun install --frozen-lockfile`
- `bun run test`
- `bun run test:native` — 11 lifecycle/key-state checks using a fake window host, plus native compilation; registers no shortcuts.
- `bun run typecheck`
- `bun run check:ui`
- `bun run test:ui` — starts and stops its own isolated shim on port 8331. Uses installed Edge headlessly under Node with controlled AI/launch responses; no OpenCode host or subscription is needed. Set `SEARCH_TEST_URL` only to test a separately managed candidate. It does not exercise Windows shortcuts.

To run an isolated shim, set `SEARCH_SHIM_PORT` to an unused port and run `bun main.ts`. `SEARCH_OPENCODE_URL` selects the existing dedicated OpenCode host (default 8322); `SEARCH_OPENCODE_LOG` points at that host's private stdout log if testing another checkout. The credential stays server-side. Do not start a second host against a shared database. `node measure-ui.mjs` measures five real game-location submissions against the candidate at 8331; it makes real subscription-backed calls.

The candidate exports local-search, retrieval, session-creation, subscription, prompt-admission and post-admission-first-token timings in the done event. The last phase includes host scheduling, proxy and model time; it is not pure model latency. Browser submit-to-visible-text latency must also be measured.

`start.ps1`/`install.ps1` are the existing experimental startup mechanism, not a verified release installer. Startup uses the shared dedicated host port, profile and mutex. Restoring `startup-before.lnk` restores the saved login entry, but full rollback, window cleanup, sign-in startup and absence of owned orphan processes have not been established. Do not install or publish this candidate on the strength of package tests.

Current checks: 28 package tests, 11 simulated native lifecycle checks and 10 headless interaction tests pass; typecheck and UI syntax pass. Native desktop verification remains blocked by the missing Computer Use bridge and visible-UI approval rejection. Only this repository's checks gate its code changes. Historical opencode-config failures are recorded in the audit for provenance and are not release blockers for this application.

Subscription proxies must already be running at their configured endpoints; startup does not execute source from opencode-config. The old config PR is superseded by this repository. The existing local installation is not migrated by extracting the source: changing its startup location requires a separately verified installation/rollback.

Native candidate behavior: Win+S/Alt+Space toggle the owned Edge app window;
Escape hides it and restores the prior app if that window still exists. A held
shortcut triggers once per press. Ownership uses a persistent profile identifier
in the native page title and verifies the Edge executable. Discovery continues
through slow launches instead of blindly opening duplicates. Only a confirmed
nonzero Edge exit enables an automatic launch retry; an unresolved successful
launcher exit with no window requires investigation rather than another launch.
The bar follows the previous app's monitor work area. Reopening selects the
existing query without submitting it. Hiding cancels a pending response; ordinary
focus loss alone does not. These are candidate behaviors, not physically verified
claims. `hotkey.ps1 -Check` compiles even when the installed helper owns the mutex.

The shim prepares an empty OpenCode session for Haiku at startup and for the
selected model when the bar loads, regains focus, or changes model/service speed.
It also replenishes after a successful answer. Expired empty sessions refresh on
reopening. No preparation invokes inference, and prompted sessions are never
reused. A cold immediate submission still waits for preparation if necessary. Local suggestions use a 40ms debounce. Responses carry
phase timings and input/output token usage for diagnosis; these are not billing
figures. See RELEASE-AUDIT.md for measured warm results and remaining release gates.

## Luna service speed

Luna uses low reasoning with a separate Normal / Fast selector. Fast requests
`service_tier: priority`; it does not reduce reasoning or select a different
model. Choices persist locally. Selecting/changing a model or service speed never
submits a prompt. Haiku remains the initial default, and Sol/Grok remain available.

Luna uses OpenCode's native OpenAI Responses adapter with the existing loopback
subscription proxy. The proxy's Chat Completions translator drops service_tier;
its Responses translator preserves priority. No direct paid API route or new
credential is introduced. Activating this config in an installation requires the
dedicated OpenCode host to reload it; this PR does not change the running install.

Fast is explicitly a request. Codex subscription response metadata can report
`default` even when Fast is active; it is not a reliable delivery indicator.
The earlier inference that default meant a downgrade was incorrect. The local
Codex catalog advertises Fast for Luna. Final outbound traces confirm that this
proxy sends priority over both HTTP and WebSockets. However, our controlled
throughput checks showed no material gain: HTTP median 58.28 Normal / 57.00 Fast
requested tokens/sec (four each); WebSocket 57.71 / 57.12 (two each). No measured
acceleration or billing claim is made. See RELEASE-AUDIT.md and
luna-fast-transport-results.json for conditions and maintainer sources.

[Codex Fast documentation](https://learn.chatgpt.com/docs/agent-configuration/speed)
currently describes GPT-5.6 Fast as 1.5x model speed with 2.5x credit consumption;
API pricing is separate. These are product-level terms, not measured charges for
this proxy account. The selector warns that Fast uses more credits.

Selection preparation reduced median session setup during submission from 553ms
to 0.3ms in 12 actual headless browser journeys. Median Enter-to-visible-text was
2.68s before / 2.30s after; excluding the first cold-host run, baseline was 2.50s.
These small, variable samples establish removal of setup overhead, not a stable
model speedup. Luna stays low/Normal; no extra inference or Fast credit premium
is needed for this improvement. See selection-latency-results.json and the audit.
# Finding files outside the startup index

Deliberate submissions can now ask OpenCode to search real filename and folder
metadata with a read-only `search_files` tool. It can narrow roots and keywords or
search deeper after an incomplete scan. This is not content/OCR search or a full
disk index. Search coverage and limits are expandable below the answer. Same-name
files remain separate; fuzzy discovery never authorizes automatic launching.
An index miss alone no longer starts a web search. Explicit requests such as
“search the web for …” and clearly current-information questions can retrieve web
snippets; other general answers use model knowledge and are not live verification.

The dedicated OpenCode host must load this checkout's `runtime-config`, with the
MCP working directory resolving to this repository. The `bun` executable must be
available to that host. Default roots are the profile's Desktop, Documents,
Downloads, Projects, Pictures, Music and Videos. To supply explicit roots, set
`SEARCH_PC_ROOTS` in the host environment to a JSON array of objects with unique
lowercase `id` and absolute `path` fields. Restarting the host applies root changes.
This candidate does not update the installed host or login startup.

`bun run bench:discovery:local [seed]` benchmarks existing local files without AI
or uploads. Ground-truth filenames stay in ignored `.cache`; the separate report
contains ranks, depths and timings. See [discovery audit](DISCOVERY-AUDIT.md) for
measurements, remaining blockers and the distinction between local scanner tests
and model-driven search. Recommendation remains **do not release**.
# Deep investigation benchmark

See [the real-file AI benchmark](REAL-AI-BENCHMARK.md) for live Haiku/Luna quality,
latency, token measurements and remaining grounding failures.
See [the deep-search benchmark](DEEP-BENCHMARK.md) for the 100-case retrieval suite,
Windows Search index baseline, actual model failures and browser measurements.
Scans now default to depth 20 and return a continuation when the traversal budget
is exhausted. OpenCode can continue without rescanning the same prefix. This still
searches names and paths, not file contents. The results do not establish a 100×
advantage or release readiness.


Pure numeric expressions (including “calculate 12.5 × 4”) skip web retrieval but
still receive an OpenCode answer. The bar labels this “Calculation · OpenCode”.
Dates, IP addresses, currency conversions, mixed text and current-fact questions
do not use this shortcut. In the repeated four-pair browser comparison, median
first text improved 1.45s → 1.27s and completion 2.18s → 1.58s, with ~15% fewer
input tokens. These small-sample arithmetic results do not generalize to other
queries; see arithmetic-latency-results.json for both batches and conditions.
## Opt-in model benchmarks

The benchmark runners use a separate agent with all tools denied and no MCP
servers, so copying the product runtime cannot enable PC discovery during a
model-only comparison. The model matrix uses supplied synthetic evidence. The
older `bench:models` runner still reads the local startup index and sends selected
metadata with prompts; obtain explicit metadata-transfer permission before running
it. Neither runner is part of CI or a daily-use release qualification.

Run the opt-in subscription model benchmark from this repository with
`$env:SEARCH_BENCHMARK='1'; bun run bench:models`. Set `SEARCH_OPENCODE_URL` and
`SEARCH_OPENCODE_LOG` to the intended test host and its local credential log.
The benchmark submits up to 70 real prompts (two passes, seven query categories,
five models), disables a model after its first error, and never launches apps.
It adds Haiku 3.5 and Spark only to its own process and writes an isolated config
under `.cache/benchmark-runtime`; an OpenCode host must load that configuration
at startup to test those additional models. The installed host normally permits
only the product's existing models. Do not change the installed host to run it.
`SEARCH_BENCH_MODELS` can restrict the comma-separated model IDs. Results and
local paths stay in ignored `.cache` files. The runner removes its own sessions;
stop any separately started test host after it completes. Read MODEL-BENCHMARK.md
for the recorded run, quality failures and limitations.

The expanded reasoning screen is separate: set `SEARCH_BENCHMARK=1` and run
`bun run bench:matrix prepare`. It inventories the live subscription catalog and
writes an isolated host configuration under `.cache/matrix-runtime`. Start a
separate OpenCode host with that config and a separate database, then set
`SEARCH_OPENCODE_URL` and `SEARCH_OPENCODE_LOG` for that host and run
`bun run bench:matrix screen`. Reserve loopback port 8337 for its observing relay.
The runner sends fixed public synthetic evidence only and observes the outgoing
model and reasoning field without logging credentials. It does not read the PC
index. Selected combination keys can be repeated with `SEARCH_BENCH_CELLS` and
`bun run bench:matrix finalists`. Stop the owned test host after the run.

The screen probes two low-cost settings per advertised text model; full declared
reasoning levels remain in `model-reasoning-inventory.json`. Unbenchmarked higher
levels are not claimed to work. Reasoning requests reaching the proxy do not
prove how its upstream normalizes them. See MODEL-REASONING-BENCHMARK.md.
