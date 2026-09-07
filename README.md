# OpenCode Windows search bar

A loopback search/launch bar backed by the installed OpenCode v2 server. Enter always searches the PC and sends the hits to the selected OpenCode model. Clicking a result opens the indexed target. Exact app/game names and explicit open/play/run requests launch automatically; location questions do not.

Haiku (claude-haiku-4-5-20251001) is the default. Luna and Sol use the existing CLIProxyAPI at 127.0.0.1:8317; Grok uses grok-sub-proxy at 127.0.0.1:3011. The four-entry model allowlist has no metered xai route. The bar never directly calls a model completion API.

The index includes installed Steam manifests and libraries, Start menu shortcuts and Get-StartApps, and immediate contents of C:\Users\Jk101\Projects. It refreshes every minute. It is not an exhaustive recursive index of every disk file. Every submitted query searches this index before answering. Web/general queries without local results retrieve Bing RSS snippets; if retrieval is unavailable, OpenCode answers from general knowledge and labels that limitation. Local location requests are not sent to web search.

The model receives verified results and launch outcomes; it cannot execute commands. Launch endpoints accept only matching identifiers and targets in the current index, require JSON, and reject foreign browser origins. All services bind to loopback. The dedicated OpenCode server generates its own local password, read from its private local stdout log by the shim; it never reaches the browser. The dedicated database and logs are ignored by Git.

## Run and verify

From this directory:

- bun install --frozen-lockfile
- bun run test
- bun run typecheck
- powershell.exe -NoProfile -File .\hotkey.ps1 -Check
- powershell.exe -NoProfile -File .\start.ps1 -Port 8321

Open http://127.0.0.1:8321/ for candidate testing. Production/default bar port is 8320, dedicated OpenCode port is 8322. Start uses the installed OpenCode binary with an isolated configuration and database, leaving other OpenCode sessions alone. CLIProxyAPI is reused and must already be running. The existing SuperGrok proxy is started hidden if its port is absent.

For this explicitly requested local installation, run powershell.exe -NoProfile -File .\install.ps1 from the reviewed checkout. It backs up the existing login shortcut, replaces only search-bar processes, and sets up hidden startup. No Explorer injection or Windows search binary replacement is involved.

To undo login startup, restore startup-before.lnk to the same Startup shortcut path. Stop only the task's main.ts and hotkey.ps1 processes and launch the previous search-shim-launch.vbs if returning to the prior bar. Do not terminate unrelated OpenCode processes.

## Observed candidate verification

The actual Edge Ask window was used to submit “Where is 7 Days to Die”, “Where are my projects”, “Calculator”, and “Why is the sky blue?”. The game answer used C:\Program Files (x86)\Steam\steamapps\common\7 Days To Die and the Projects answer used C:\Users\Jk101\Projects with real child folders. Calculator started (verified OS process), and clicking Projects produced successful launch feedback. The web answer showed NASA and other source links.

Observed first token times in the bar were 1.40–2.00 seconds (one later Projects run: 1.90 seconds); total times were 2.31–2.97 seconds. These are actual end-to-end UI observations, not a guaranteed latency. Short route checks also succeeded through OpenCode for Luna, Sol, and SuperGrok.

Physical Win+S/Alt+Space verification is pending: native keyboard automation was unavailable. The helper compiled and reported successful hook registration. Browser-emulated Alt+Space does not exercise the Windows hook.


Package regression tests and strict typecheck passed. Repository gate: 733 passed, 1 skipped, 0 failed. Static smoke passes until the pre-existing headless-process violation in ui-lab/pen-mcp.ts; no search-bar violations remain.
