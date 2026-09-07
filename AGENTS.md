# Windows Search

This repository owns the Windows search replacement: UI, minimal loopback shim,
indexing, launcher, startup scripts, tests and release decisions. OpenCode v2 and
subscription proxies are external runtime dependencies, not source dependencies
on the opencode-config repository.

Run from this repository root:
- bun install --frozen-lockfile
- bun run test
- bun run test:native
- bun run typecheck
- bun run check:ui
- bun run test:ui

The headless UI suite starts an isolated shim and mocks AI/launch responses. It
requires installed Edge but no OpenCode account or proxy. Real model and physical
Windows interaction checks are separate release gates in RELEASE-AUDIT.md.

Keep Haiku default, Luna/Sol/Grok selectable, and no metered xai routes. Typing
must never invoke AI; deliberate submissions go through OpenCode v2.

Use task branches and ready PRs. Do not merge, install, publish or change login
startup without explicit authorization. Tests must never install the bar or
change global shortcuts. Preserve other sessions and shared OpenCode/proxies.
Do not import unrelated opencode-config tests or release gates.
