# Expanded model Ã— reasoning benchmark â€” 2026-09-07

The first four-model comparison did not control reasoning and was too narrow to establish a general winner. This run screens the full currently advertised text catalog and repeats promising model/effort pairs. The default and installed product remain unchanged.

## Scope and controls

The live CLIProxyAPI catalog contained 24 entries: 21 general text models, two image models, and the internal codex-auto-review entry. The latter three were excluded. Adding the existing SuperGrok route produced 22 text models and 44 model/effort cells. Each cell received one short exact-location query. Thirty cells completed; fourteen failed across seven models. Successful cells observed the expected requested model ID and reasoning field at the OpenCode-to-subscription-proxy boundary. All 44 cells reached that boundary, including failures.

Unlike the earlier installed-index run, this screen and its repeat use public synthetic paths only (C:\Games\7 Days To Die and C:\Projects). Automatic approval review rejected broad disclosure of real indexed paths; synthetic fixtures were the safer authorized alternative. These results measure model/effort behavior under controlled evidence, not actual installed-PC discovery, web retrieval, native focus or launches.

An isolated OpenCode host used the same agent instructions and existing subscription proxies. A loopback-only relay observed model, reasoning_effort, response status and time to upstream response headers; it did not save credentials or prompts. The relay does not call a model directly on behalf of the UI: the full OpenCode session/event/prompt path remains in use. First text and completion are measured after empty-session preparation; they exclude UI, indexing and retrieval. Header latency is not provider first-token latency. No pure-model latency claim is made.

The [matching CLIProxyAPI release metadata](https://github.com/router-for-me/CLIProxyAPI/blob/v7.2.147/internal/registry/models/models.json) and [reasoning-control documentation](https://help.router-for.me/configuration/thinking) informed the low-cost pair selection. For budget-based Claude models, low maps to a budget; for GPT families, the declared low/medium pair was used. Default means the field was absent, not that reasoning was off. High/xhigh/max levels are inventoried, not benchmarked. Missing metadata is labeled a probe. CLIProxyAPI metadata for Grok does not prove the separate SuperGrok adapter supports the same levels. Wire observation proves the request reached the proxy, not that an upstream honored it without normalization. Fable demonstrated a metadata/backend disagreement.

## Full screen: one query per cell

These single samples are screening results, not stable rankings. The first Terra/low sample includes 1219ms prompt admission. Successful-answer latency is not averaged with outages.

| Model | Setting 1: first / complete | Setting 2: first / complete |
| --- | --- | --- |
| gpt-5.6-terra | low: 3193 / 3744ms | medium: 2546 / 4473ms |
| gpt-5.6-luna | low: 1490 / 2164ms | medium: 1315 / 1954ms |
| claude-sonnet-5 | none: 1207 / 2044ms | low: 1054 / 1901ms |
| claude-opus-4-5-20251101 | none: 1623 / 1949ms | low: 2345 / 2688ms |
| claude-opus-4-1-20250805 | default: FAILED (404) | low: FAILED (503) |
| gpt-6-astra | default: 1903 / 2741ms | low: 1965 / 2866ms |
| claude-opus-4-6 | none: 2437 / 2776ms | low: 2095 / 2445ms |
| claude-opus-4-7 | none: 2505 / 2989ms | low: 2142 / 2537ms |
| claude-opus-5 | none: 1687 / 2211ms | low: 1739 / 2271ms |
| claude-fable-5 | none: FAILED (400) | low: FAILED (429) |
| claude-3-7-sonnet-20250219 | default: FAILED (404) | low: FAILED (503) |
| claude-fable-5-1 | default: FAILED (400) | low: FAILED (400) |
| gpt-5.5 | low: FAILED (404) | medium: FAILED (404) |
| claude-sonnet-4-5-20250929 | none: 1648 / 1984ms | low: 3408 / 3793ms |
| claude-sonnet-4-6 | none: 1686 / 2080ms | low: 1988 / 2504ms |
| claude-opus-4-20250514 | default: FAILED (404) | low: FAILED (503) |
| gpt-5.6-sol | low: 1630 / 2590ms | medium: 1629 / 2644ms |
| claude-haiku-4-5-20251001 | none: 1067 / 1474ms | low: 2163 / 2567ms |
| claude-opus-4-8 | none: 1597 / 2171ms | low: 1581 / 2061ms |
| claude-sonnet-4-20250514 | default: FAILED (404) | low: FAILED (503) |
| gpt-5.3-codex-spark | low: 1311 / 1674ms | medium: 1564 / 1942ms |
| grok-4.6 | low: 1963 / 2363ms | medium: 2747 / 3048ms |

Observed failures:

- Opus 4.1, Opus 4, and Sonnet 4 / 3.7 returned model-not-found errors; subsequent low attempts received 503 and timed out after OpenCode retries.
- GPT-5.5 returned model-not-found/access-denied errors for both settings.
- Fable 5 rejected thinking off despite static metadata allowing zero; low returned 429 and timed out while OpenCode retried.
- Fable 5.1 rejected both settings, reporting a Claude Code client-version requirement (2.1.251 or newer versus the request identity 2.1.220). No shared proxy/client was upgraded.

OpenCode emitted four wire requests for each of five timed-out cells, so 44 completion attempts produced 59 observed proxy requests. The runner itself did not replay a failed prompt. These 429/503 retries must not be mistaken for four successful generations, but they are material recovery latency.

## Repeated finalist comparison

Haiku, Luna, Sonnet 5 and Spark were selected for competitive short-answer timing and relevance to a low-consumption search bar. Each ran two settings across four tasks, twice: exact location, semantic selection with all synthetic candidates supplied, unverified current information with no sources, and Projects. There were 64 valid finalist measurements after excluding 16 initial Projects samples and replacing them with 16 corrected reruns (80 finalist attempts in total). The original synthetic Projects fixture was removed by a host-specific production search filter, a benchmark defect now regression-tested. Some invalid responses used OpenCode-injected workspace context instead of search evidence; those answer texts are omitted from the public artifact. Synthetic prompts do not mean the OpenCode host is free of ambient session context. Candidate order was fixed within each task; request/load/order effects remain possible. No claim of statistical significance is made from two samples per task.

| Model / setting | Answers | Median first | Median complete | Median input / output / reasoning |
| --- | ---: | ---: | ---: | --- |
| 5.6-luna / low | 8 | 2129ms | 2625ms | 793 / 20 / 0 |
| 5.6-luna / medium | 8 | 1816ms | 2876ms | 794 / 20 / 0 |
| sonnet-5 / none | 8 | 4760ms | 5229ms | 912 / 34 / 0 |
| sonnet-5 / low | 8 | 1740ms | 2712ms | 911 / 34 / 0 |
| haiku-4-5 / none | 8 | 1062ms | 1485ms | 647 / 22 / 0 |
| haiku-4-5 / low | 8 | 2503ms | 2898ms | 675 / 172 / 0 |
| 5.3-codex-spark / low | 8 | 1766ms | 2115ms | 498 / 25 / 142 |
| 5.3-codex-spark / medium | 8 | 1991ms | 2310ms | 497 / 26 / 292 |

Task-level first-text medians (two samples per cell):

| Model / setting | Exact | Semantic candidates | Current, no sources | Projects |
| --- | ---: | ---: | ---: | ---: |
| 5.6-luna / low | 1737ms | 2196ms | 2720ms | 2082ms |
| 5.6-luna / medium | 3153ms | 1617ms | 2979ms | 1518ms |
| sonnet-5 / none | 3061ms | 5165ms | 3452ms | 3375ms |
| sonnet-5 / low | 1498ms | 5050ms | 1682ms | 3005ms |
| haiku-4-5 / none | 1221ms | 1195ms | 1033ms | 1011ms |
| haiku-4-5 / low | 2371ms | 2277ms | 4207ms | 2481ms |
| 5.3-codex-spark / low | 2436ms | 1801ms | 1767ms | 1748ms |
| 5.3-codex-spark / medium | 1797ms | 1933ms | 1991ms | 3256ms |

## Quality and consumption

| Setting | Exact + semantic + corrected Projects | Current-fact safeguard (2 trials) |
| --- | --- | --- |
| Haiku / none | All supplied root/game paths correct; brief Projects summaries | Failed both: asserted current facts without verification |
| Haiku / low | All supplied root/game paths correct | Passed both: explicitly could not verify current information |
| Luna / low or medium | All supplied root/game paths correct | Failed all four: knowledge labels were inconsistent and no clear current-verification limitation |
| Spark / low or medium | All supplied root/game paths correct; Projects answers unnecessarily listed full child paths | Failed all four: labeled knowledge but still asserted the current fact |
| Sonnet 5 / none or low | All supplied root/game paths correct; longer Projects summaries | Passed all four: explicit lack of current verification, older knowledge qualified |

Current-question grading checks provenance and uncertainty, not whether a political
name happens to be correct. No current answer was web-verified in this fixture.
Every finalist identified the game when the candidate catalog was supplied. That
is evidence for improving retrieval into the AI path, not proof that the installed
bar now handles vague requests. The product matcher still does not supply those
candidates today.

Haiku/none had the best latency here, but its failed grounding makes it an unsafe
unconditional quality winner. Haiku/low used a median 172 reported output tokens
versus 22 with thinking off, despite similarly short visible local answers. The
proxy does not report separate Claude reasoning tokens here, so these fields must
not be equated with visible text alone. Spark/low used a median 142 reasoning
tokens versus 292 at medium (about 51% fewer), with slightly faster mixed-task
medians. Luna's low/medium latency was noisy, without a demonstrated quality gain.
Sonnet 5/low handled provenance better, but its two semantic trials both took about
five seconds; a favorable overall median hides that friction.

No billing charges or subscription quota deltas were measured. No metered xai
route was used. Catalog/model size, returned token accounting and dollar cost are
different things: this does not establish that Sonnet or a larger model is cheap.
All generation used existing subscriptions, with short prompts and only lower
reasoning settings. Higher efforts remain untested intentionally.

The expansion made 124 completion attempts: 44 screen, 64 initial finalist and
16 corrected Projects reruns. There were 110 successful completions, of which
16 were excluded for the fixture defect, and 14 failed screen attempts. The
artifact retains excluded measurements with an explicit flag but omits their
workspace-derived answer texts. The accepted comparison contains 94 successful
measurements. Ambient OpenCode workspace context remains a confounder and a
possible source of ungrounded local answers; the run did not enumerate private
files or use the live PC index.

## Decision and release status

The original model-only ranking was insufficient. Preserve Haiku as the current
default, but treat reasoning as an explicit configuration dimension. Haiku with
thinking off is the speed/consumption baseline; Spark/low is a useful alternative
to test further; Sonnet 5/low is a quality candidate with serious latency variance.
None earns a release-ready recommendation from this small benchmark. Do not
change defaults or add advertised models until their availability, reasoning
semantics, grounding and whole desktop journey have passed release gates.

Priorities remain: provide useful indexed candidates for vague requests, prevent
ambient workspace paths being presented as retrieved evidence, enforce honest
current-information limitations, and avoid long unavailable-route retry waits.
Physical shortcuts/focus, actual launch identity, DPI, startup/uninstall and real
outage recovery remain unverified. No product runtime config, installed bar,
startup registration or shared proxy was changed by this expansion.

All owned sessions were removed after each phase (zero remaining, zero cleanup
errors); the isolated host and relay were stopped. Validation: 25 tests with 95
assertions, strict typecheck including both benchmark runners, UI syntax, 11
fake-host native lifecycle checks and compilation, and eight headless Edge tests.
The synthetic Projects regression now verifies the intended evidence independently
of the machine-specific Projects search filter. CI never runs paid/subscription
inference.
