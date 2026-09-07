# Standalone repository status

This audit was performed before extraction from opencode-config. The application
now lives in Noisemaker111/windows-search, with its own package and Windows CI.
All references below to config PR #3, config tests, desktop-inert rules and old
checkout paths are historical evidence. Those repository-specific failures are
NOT release gates for this app. Native behavior, latency, retrieval, launch and
lifecycle findings remain applicable. No installation or deployment was performed.

# Release audit — initial assessment (2026-09-07)

Recommendation before changes: DO NOT RELEASE. Earlier README/PR observations are historical, not verification of this audit. Installed service: 201 entries, OpenCode reachable. Native use was attempted first: @oai/sky initialized but list_windows failed with native pipe missing (os error 2). Visible browser checks were blocked by approval review. No physical shortcut or desktop experience claim is justified.

| Priority / status | Reproduction and observed behavior | Impact / likely cause | Acceptance criterion |
| --- | --- | --- | --- |
| P0 verified logic defect | Search `open calcluator`: Calculator score 78; launchIntent returns true. Existing test explicitly expects this. | A guessed match becomes an action. Single-candidate fuzzy scores bypass the ambiguity gate. | Only an exact normalized name auto-launches; all partial, acronym and fuzzy matches require explicit selection. Location requests never auto-launch. |
| P0 verified source defect; physical behavior untested | Escape handler only stops or clears. Hook Toggle only raises/opens. No prior-window tracking or dismissal exists. | Cannot behave like a transient Windows search surface. Held hotkeys also retrigger every 350ms; discovery relies on a generic window title. | Win+S and Alt+Space from two apps open one bar, input receives focus, held key opens once, Escape dismisses and restores prior app, 20 repeated cycles without native Search or duplicate windows. |
| P1 verified source defect | Click calls /run; input Enter on selection calls /ask. Successful identical submission is blocked indefinitely until editing. | Different mouse/keyboard behavior; cannot deliberately retry unchanged query after completion. | Click and selected Enter each produce one launch request and one OpenCode submission; held Enter produces one; a new deliberate Enter after completion can retry. |
| P1 verified real retrieval defect | `Who is the current president of France?` returned Current banking, Yahoo and Current Catalog sources and a Web badge. Model correctly declined. | Irrelevant snippets are presented as grounding. Retrieval accepts any HTTPS RSS item; any local hit suppresses web search. | Current-information questions retrieve relevant evidence or explicitly report failure to verify; local intent is not leaked to web; no general-knowledge fallback masquerades as current verification. |
| P1 verified latency, cause unresolved | Two sequential real Haiku game queries: first token 2156/1972ms, complete 2599/2870ms (HTTP clients 2602/2876ms). | Search replacement delays the answer; current metric excludes local search and cannot split host setup/provider. | Record client submit-to-token/completion and server local search, retrieval, host setup and post-prompt wait separately over >=5 repetitions. Provisional target: local feedback p95 <150ms, warm local-query token p95 <1500ms; report failures, not just means. |
| P1 verified source reliability defect | OpenCode stream has its own 45s timeout; finally interrupts only when outer signal is aborted. Error send suppresses events on timeout. | Timeout can leave generation active and UI silently finishes. Interrupt request itself has no timeout. | Transport failure/timeout/cancel interrupts owned execution; terminal error reaches connected client; active count returns to zero and next submission succeeds. |
| P1 verified reporting limitation | /run returns Start-Process success; AI event says Opening. | Dispatch is not evidence the intended app opened; packaged apps and Steam paths evade existence check. | UI says launch requested, never confirmed open; stale disk paths fail before dispatch; native app identity verified for release. |
| P1 verified coverage limitation | `VS Code` returns no matches; Projects returns root and first 11 children; source reads immediate Projects children only. | Familiar abbreviations and deep project content are undiscoverable. Coverage is hidden behind Find anything copy. | Common aliases find installed targets, missing items remain missing, coverage shown plainly; multi-library fixtures and duplicate identity behavior checked. |
| P1 untested physical/lifecycle | Cold start, sign-in, competing Windows Search, scaling, multiple monitors, uninstall and orphan checks not performed. Source uses fixed window coordinates; startup and OpenCode ports/profile are shared; no automated uninstall. | Core daily-use and recovery claims unsupported. | Cold/warm/login starts, two monitor/DPI configurations, actual proxy outage recovery, and install/rollback exercised with only owned processes affected. |
| P2 source concerns, visual untested | Input lacks combobox role; suggestions cleared on every edit; fake green status dot; answer precedes local results; 10px ellipsized paths. | Focus/selection accessibility, flicker, unsupported health impression and weak result hierarchy. | Headless keyboard/overflow checks plus native visual use at 100/150/200% scale. Keep local matches available above answer; expose full paths without mouse-only tooltip. |

## Execution boundary

Work is isolated in an audit worktree. No installation, production deployment, merge, startup replacement, unrelated process termination or provider route change is authorized by this audit. Existing PR #3 is the update target. Headless browser and service checks supplement but cannot replace physical Windows interaction.

## Changes and repeat verification

Candidate fixes:

- Fuzzy/partial/acronym results no longer authorize automatic launch. Exact commands still do; explicit mouse/keyboard selection is the opt-in for a suggestion. Stale Steam directories fail before protocol dispatch.
- Click and selected Enter use the same /ask path. Typing/model changes stay local. Repeated keydown is suppressed across controls, pending submissions are suppressed, and a fresh deliberate submission can retry after completion. Click returns input focus.
- Broken/truncated streams report failure. Incomplete OpenCode executions are interrupted on failure, disconnect, cancellation and timeout, with bounded cleanup. A controlled test stalled with AbortSignal.timeout; an explicitly owned timeout timer fixed the reproduction.
- Existing web query eligibility/destination are unchanged. An inexpensive relevance filter rejects obvious unrelated snippets; badges no longer imply verified live answers. Instructions distinguish missing indexed locations from general knowledge and refuse unsupported current claims. This mitigates misleading evidence; it does not fix retrieval quality or local/web intent classification.
- Local results precede the answer. Full paths wrap at a readable size, long names fit a narrow viewport, the input has combobox/active-option semantics and visible focus, and the decorative green health indicator is removed. These changes address concrete hierarchy/accessibility friction; they are not native visual approval.

### Measured evidence

Five real sequential headless Edge submissions on a 780x560 viewport, Haiku through the configured OpenCode host, query `Where is 7 Days to Die`:

| Run | Submit to visible first text | Submit to completion |
| --- | ---: | ---: |
| 1 | 4943ms | 5491ms |
| 2 | 2356ms | 2973ms |
| 3 | 2287ms | 2904ms |
| 4 | 1955ms | 2523ms |
| 5 | 1706ms | 2573ms |

Median first text 2287ms; observed range 1706–4943ms. Five samples do not establish a stable percentile. No speed improvement is claimed. These were instrumented-candidate measurements before the final timeout/keyboard cleanup, which did not change the successful generation path. Baseline HTTP-only numbers above are not a comparable browser benchmark.

A separate five-query server series measured first token 1901–2028ms and completion 2418–2523ms. Breakdown: local matching 1.65–3.47ms; retrieval effectively zero for this local query; session creation 528.6–685.6ms; event subscription 1.35–2.63ms; prompt admission 27.2–37.3ms; post-admission first text 1186–1468ms. Session creation is a material cost. The final interval combines host scheduling, proxy and model latency: separating pure provider time still requires proxy/host tracing. No direct completion API was used to manufacture a faster path.

The final loaded candidate also answered through Luna (3201/4267ms first/total), Sol (2771/4461ms) and Grok (4449/5499ms). One sample per alternate model, with repository checks active during that series; not a comparative performance benchmark. Each returned the indexed game installation path. No metered route was used.

Real headless typing of `7 dyas to die` produced one local lookup, zero submissions and zero model calls. Editing during a real answer produced one cancellation and active=0; the next Projects query completed with C:\Users\Jk101\Projects and actual indexed children. The final missing-item query said it was not found in indexed locations and invented no path. Answers still sometimes include unnecessary Steam identifiers and wordy fallback text.

The public France-president retest rejected all four irrelevant snippets, showed `No verified answer sources`, and explicitly declined to verify current facts. It took 4797ms first token / 5955ms total, including 345ms retrieval and 2624ms session creation. Useful current web answers are NOT established. The lexical filter is only a conservative heuristic and can reject useful paraphrases or admit misleading keyword overlap.

Live rebuild observed 201 entries: 11 games, 153 apps, 25 folders, 12 files. Games were indexed from C:\Program Files (x86)\Steam and C:\Games\Steam. Index timestamps advanced during the run while health remained successful. Exhaustiveness, stale shortcut targets, name-based deduplication collisions, deeply nested Projects content and missing-app diagnosis remain unverified. VS Code alias behavior is covered with an installed-target fixture; this does not prove that app is installed on this PC.

A separate owned shim pointed at an unused local OpenCode port returned an explicit stream error and active=0. Shared proxies were not stopped. Real proxy/model outage recovery, login startup, uninstall/rollback and native app opening were not exercised.

### Checks and limits

13 package tests (56 assertions), strict typecheck, client syntax, and 7 headless Edge interaction tests pass. Browser tests exercise typing/pause/replacement/IME, held Enter, deliberate retry, click/keyboard parity, stale-response rejection, truncated response, model change after outage, and narrow long-path layout. Launch and outage responses in that suite are controlled fixtures; this is not proof of desktop launch. Physical clipboard paste, held hardware Enter and multi-monitor/DPI behavior are still untested.

The exact root `bun test` gate: 443 passed, 1 skipped, 1 failed. Failure: `test/tui-slots.test.ts`, installed host binary slot extraction returned no expected slots. Running that file against the unchanged PR checkout reproduced it (7 pass / 1 fail). Do not present historical 733-test claims as this run's result.

Initial root smoke passed headless/static checks, then failed the focus sentinel with a foreground-window transition. One retry invoked from the package directory failed its relative scripts lookup; that was an invocation error, not a product defect. The final root rerun is recorded below. No check was weakened.

### Remaining release blockers / recommendation

DO NOT RELEASE. P0 native transient-window lifecycle remains absent/unverified: Escape dismissal, focus restoration, repeated hardware shortcuts, native Windows Search competition and duplicate-window handling. Native verification was attempted first, but the Computer Use pipe was unavailable; automatic approval review also rejected visible browser access under the repository's desktop-inert rule. The user's requested physical verification has not happened.

P1 blockers remain: unacceptable/variable answer latency; reliable, relevant current web retrieval; actual launch identity/failure confirmation; exhaustive enough indexing and safe duplicate identities; sign-in/cold-start ownership, rollback and orphan lifecycle; multi-monitor/DPI and native keyboard/screen-reader checks. Repository gates are not fully green. The installed checkout and startup registration were not changed; the candidate is reviewable in PR #3, not installed or published.

Runtime recovery handoff: restore the supported @oai/sky native bridge for this Codex session (initialization succeeded, list_windows failed with native pipe missing, os error 2). Honor the user's explicit search-bar/test-app UI authorization while keeping unrelated desktop state private. Preserve the existing PR and the audit changes. First prove native list_windows works, then run the P0 acceptance matrix above against the candidate. Do not restart shared OpenCode/proxies, change provider selection, or infer that hook registration proves physical operation.

Final smoke rerun from the repository root passed the focus sentinel (20 hidden launches), headless policy and static checks, then failed two usage/quota tests in the **live main config checkout** selected by the smoke script: `jsonc has no leftover model-* fake agents` and `quest giver dispatches implementers` (`parse is not defined`). Result 101 pass / 2 fail. This gate checks installed configuration outside the candidate; it is still not green and was not modified by the audit.

Cleanup: the first Bun-driven headless Edge attempt timed out; later inspection found no remaining process for its exact temporary profile. The first candidate shell interruption left a listener, so it was identified by its reserved port/process command and stopped explicitly. Final candidate and outage processes are tracked by their returned PIDs for cleanup; installed bar, hotkey, OpenCode host, proxies and login shortcut remain untouched. This is evidence about the audit harness cleanup, not a verified product uninstall.

Final cleanup verified: both audit process IDs absent, no listeners on 8331/8333, final candidate active count zero, installed 8320 service still healthy with 201 entries.


## Native lifecycle follow-up (standalone repository)

The helper now has a tested lifecycle controller and a Windows adapter. It tracks
press/release state, uses a profile-specific identity instead of generic Ask title
matching, suppresses duplicate opens while Edge startup is unresolved, toggles and
Escape-hides the owned window, restores a valid prior app, and positions on that
app's monitor work area. Late discovery does not issue another focus request over
an app the user has selected. Extra Ctrl/Shift combinations are not hijacked.

The client selects existing input on native reopen, aborts on page hide/native
visibility loss, and does not cancel solely because another app received focus.
11 fake-host lifecycle/key checks and an eighth headless browser test cover these
contracts. The Windows helper compiles in Windows PowerShell without registering
hooks or acquiring the live mutex. CI now runs those checks independently.

Physical Win+S/Alt+Space, focus restoration, native Search/Start competition,
actual ShowWindow-to-browser visibility events and mixed-DPI placement remain
release gates. The native tool's window enumeration was blocked by automatic
approval review for unrelated-window metadata; approval was requested. No current
installation, startup shortcut, global hook or shared host/proxy was changed.
The old helper remains installed. No release-ready claim is made.

## Latency and token reduction (2026-09-07)

PRs #1 and #2 are merged into the public standalone repository. This follow-up
keeps the installed bar unchanged. It prepares at most one unused session per
selected model, defaults to preparing Haiku at startup, and consumes each session
once. Preparation creates OpenCode metadata only; it never sends a prompt. A
successful answer replenishes the slot. Unused sessions expire for reuse after
five minutes and are removed on replacement or graceful shutdown. Failed
preparation does not loop. A definitive missing-session 404 can recreate once;
transport errors and other failures never replay a possibly admitted prompt.

Typing still performs local matching only, now with a 40ms rather than 120ms
pause. Model changes do not invoke inference. Compact prompts preserve exact
paths but omit icons, index IDs, ranking and redundant launch metadata. Answers
request one sentence, with a second only when needed. Token telemetry records
OpenCode step usage, not an estimate of subscription charges.

Controlled real Haiku comparison: five alternating calls per variant through the
same existing OpenCode v2 host and subscription proxy, same indexed game query,
fresh context on every call. Baseline reproduces the merged prompt with session
creation on demand; candidate waits for empty-session preparation before timing.
These are completion-client timings, excluding browser, indexing and preparation.
No direct provider completion path or cached answer was used.

| Metric | Baseline | Prepared + compact |
| --- | ---: | ---: |
| First token, median | 2518ms | 1262ms |
| First token, range | 2199–4984ms | 1208–1483ms |
| Completion, median | 3158ms | 1821ms |
| Completion, range | 2770–5879ms | 1679–2098ms |
| Session wait | 863–983ms | below 1ms |
| Prompt bytes | 786 | 435 |
| Input tokens, median | 742 | 618 |
| Output tokens, median | 40 | 34 |

Input tokens fell 17%, output median 15%. No dollar savings are established:
these use subscriptions and no billing data was measured. The first baseline
also had 1972ms prompt admission; later baselines were 36–50ms. Prepared prompt
admission was 5–11ms, with 1194–1471ms after admission until first token. That
last interval still combines OpenCode scheduling, proxy and model; pure provider
latency has not been separated. Five samples do not establish stable percentiles
or isolate all effects of host warming and prompt shortening. Cold start and a
newly selected model may still wait for preparation. Subsecond AI is NOT met.

An isolated candidate in headless Edge returned actual local results in
128/108/91/100/96ms from automated input fill to visible result (includes browser
automation overhead). Metrics changed from zero to five searches, with zero
submissions and zero model calls. A deliberate real submission displayed first
text in 1600ms and completed in 2148ms, with the exact indexed path and no
unrequested launch advice. This is one browser sample, not a hardware shortcut
measurement. The ten comparison sessions were deleted after measurement. The
owned browser and candidate process were stopped; installed services stayed up.

Validation: 23 unit/reliability tests, 88 assertions; strict typecheck; UI syntax;
11 fake-host native checks and native compilation; eight headless Edge journeys.
New checks cover model isolation, bounded preparation, expiry, shutdown races,
failed preparation, cancellation before inference and safe 404-only recovery.

DO NOT RELEASE remains the recommendation. Native hardware shortcuts and focus,
actual target-app launch confirmation, DPI/monitor behavior, useful current web
retrieval, real proxy/model outage recovery and login/uninstall lifecycle remain
unverified. The latency improvement is material but does not close these gates.

## Expanded subscription benchmark (2026-09-07)

See MODEL-BENCHMARK.md and model-benchmark-results.json: 56 successful answers
across Haiku, Spark, Luna and Grok, plus three rejected attempts. Warm median
first text was 1347 / 2055 / 3055 / 5506ms respectively. These completion-client
timings exclude preparation, retrieval and the UI. No billing savings are proven.
Keep Haiku default for now; the benchmark does not authorize installing changes.

Confirmed blockers: vague installed-game requests supplied zero candidates to all
models; Haiku invented an unsupplied fallback Steam location once. With no web
sources, Haiku asserted a current fact twice without qualification, while the
other models labeled knowledge but still failed to explicitly withhold current
verification. Projects responses were sometimes unnecessarily large. The next
improvement must address evidence discovery and grounding, not just model choice.

The benchmark is opt-in, uses only existing subscription routes through OpenCode,
and never launches apps. The additional model catalog existed only in an isolated
host. All owned sessions were removed, that host was stopped, and the installed
bar/proxies/startup were preserved. Native release gates remain outstanding.
