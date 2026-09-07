# Windows Search

Standalone application repository: https://github.com/Noisemaker111/windows-search. OpenCode v2 is the runtime brain; this application is not an OpenCode configuration plugin.

**Experimental — do not release for daily use.** See [RELEASE-AUDIT.md](RELEASE-AUDIT.md) for verified defects, measurements, acceptance criteria and remaining release blockers. The native shortcut/focus lifecycle is not verified, and the new native dismissal/focus implementation still requires physical acceptance testing.

The loopback shim indexes Steam libraries, Start-menu shortcuts/Get-StartApps, and immediate Projects contents. It is not a full-disk or recursive file search. Every deliberate submission uses the installed OpenCode v2 host. Haiku is the default through CLIProxyAPI; Luna/Sol use the same subscription proxy and Grok uses the existing SuperGrok proxy. No metered xai route is allowed.

Typing, paste, local suggestions, example buttons, and model changes never submit to AI. Local lookup has a 120ms debounce. Enter/Ask submits; selecting a result with mouse or arrows/Enter requests its launch and submits through the same OpenCode path. Repeated Enter while pending is suppressed; a fresh submission after completion can retry. Editing, Stop, and Escape cancel the answer. Only exact normalized app/game names or explicit commands naming an exact result can auto-launch. Prefixes, acronyms and fuzzy suggestions require selection.

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

Current checks: 13 package tests, 11 simulated native lifecycle checks and 8 headless interaction tests pass; typecheck and UI syntax pass. Native desktop verification remains blocked by the missing Computer Use bridge and visible-UI approval rejection. Only this repository's checks gate its code changes. Historical opencode-config failures are recorded in the audit for provenance and are not release blockers for this application.

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

The shim prepares an empty OpenCode session for Haiku at startup and after a
successful answer, keeping creation off the warm submission path. Other models
prepare on deliberate submission. No preparation invokes inference, and prompted
sessions are never reused. Local suggestions use a 40ms debounce. Responses carry
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

Fast is explicitly a request. In six isolated real Responses checks (three Normal,
three Fast), all final service-tier metadata reported default. Thus Fast delivery
and a speed benefit are NOT established for this subscription route. The UI says
Fast requested and does not claim that priority was served. See the release audit
and luna-service-tier-results.json. The account/upstream capability or downgrade
needs resolution before advertising working acceleration.

[Codex Fast documentation](https://learn.chatgpt.com/docs/agent-configuration/speed)
currently describes GPT-5.6 Fast as 1.5x model speed with 2.5x credit consumption;
API pricing is separate. These are product-level terms, not measured charges for
this proxy account. The selector warns that Fast uses more credits.
