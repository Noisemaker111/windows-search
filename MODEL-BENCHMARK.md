# Subscription model benchmark — 2026-09-07

Keep Haiku as the default for now. It was fastest across this small mixed-query suite. None of the tested models fixes the missing-evidence problem, and none establishes reliable current web answers. Do not release based on these timings.

56 successful answers: seven query categories, two repetitions, four working models. Three additional attempts failed: the installed host rejected Haiku 3.5 and Spark before inference; an isolated host enabled both, where Haiku 3.5 returned provider.invalid-request / 404 and Spark worked. No retries after a model error within a run.

| Model | Answers | Median first text | Median completion | First text range | Median input / output / reasoning tokens |
| --- | ---: | ---: | ---: | --- | --- |
| Haiku | 14 | 1347ms | 2075ms | 1113–3824ms | 603 / 34 / 0 |
| Spark | 14 | 2055ms | 2524ms | 1702–5363ms | 456 / 33 / 248 |
| Luna | 14 | 3055ms | 3989ms | 1652–5244ms | 751 / 22 / 0 |
| Grok · SuperGrok | 14 | 5506ms | 6109ms | 3361–12331ms | 541 / 0 / 283 |

First-text medians by query category (only two samples each):

| Query | Haiku | Spark | Luna | Grok |
| --- | ---: | ---: | ---: | ---: |
| exact location | 2719ms | 2042ms | 4034ms | 3949ms |
| transposed typo | 1352ms | 1887ms | 3515ms | 4407ms |
| projects | 1220ms | 3608ms | 2154ms | 3552ms |
| vague local intent | 1403ms | 2490ms | 3049ms | 5998ms |
| missing local item | 1362ms | 2801ms | 4323ms | 6189ms |
| current web | 1345ms | 2812ms | 2724ms | 12196ms |
| general explanation | 1277ms | 2074ms | 1946ms | 6114ms |

## Conditions and cost limits

All answers used the real OpenCode v2 completion path, fresh single-use sessions, compact product prompt, actual local index and existing subscription proxies. No direct-provider shortcut, answer cache, metered xai route, launch or desktop action was used. Larger Sol/Opus/Sonnet/Astra models were omitted. Haiku 3.5 and Spark were candidates advertised by the proxy, not verified price winners. No new credentials or paid plan were created.

Timings start after preparing an empty session and end at first streamed delta / execution success. They exclude typing, UI rendering, initial indexing, web retrieval and preparation; they are NOT end-to-end desktop or cold-start timings. The first Haiku sample includes 1708ms prompt admission. That outlier is retained. Calls were sequential, rotating model order in the main run. Spark ran afterward on a separate host using the same installed binary and identical agent system/model configuration, but its own database and expanded catalog. Host/load/time differences limit comparisons. Two repetitions per category do not establish stable percentiles.

Retrieval evidence was frozen per query per run. Exact and typo queries each had one hit, Projects had twelve, vague and missing queries had none. Both web-capable queries returned zero retained sources; current-web retrieval took about 214ms in the main run, outside the table. This mirrors the product RSS/relevance policy. Model timings therefore cannot prove web retrieval quality.

Token counts come from OpenCode step events. Different model tokenizers and proxy accounting make them imperfect comparisons. Grok reported zero output tokens for every nonempty answer and a median 283 reasoning tokens: do not interpret that as free generation. Spark used substantial reasoning and returned 198 output tokens for one Projects response. Dollar charges, remaining subscription quota and per-query billing were not measured; this report makes no claim that Spark or Grok is cheaper. Haiku has the best observed latency/token profile here, subject to quality failures below.

## Quality assessment

| Journey | Observed result | Product implication |
| --- | --- | --- |
| Exact game location and transposed typo | All four returned the indexed game path in both passes. | Grounded exact lookup works; typo handling came from local retrieval, not proof of model fuzzy reasoning. |
| Projects location | All four included the root path. Haiku listed unnecessary children twice; Luna once. Spark once expanded twelve full paths into a 198-token response. Grok stayed brief. | Sentence limits alone do not enforce concise, useful answers. |
| Vague installed zombie game | All four failed to find the game in both passes because the matcher supplied zero candidates. Haiku once suggested an unsupplied default Steam path. | Confirmed retrieval blocker; one grounding violation. A different model cannot recover withheld evidence reliably. |
| Genuinely missing item | All four reported not found in indexed locations, without inventing its path. | Passed this bounded negative case. |
| Current president | No retained web sources. Haiku twice asserted a current answer with a 2026 date and no qualification. Luna/Grok/Spark labeled model knowledge but still asserted a current answer rather than saying it could not be verified. | No verified current answer; stricter source handling is still needed. This report does not verify the political claim. |
| RAM explanation | All four gave a sensible short explanation. Haiku omitted the required model-knowledge label twice; the others labeled it. | Useful general answers, inconsistent provenance presentation. |

## Recommendation and next work

Keep Haiku default and preserve existing optional models. Do not add Spark to the product menu merely because it is branded for speed: its median here was slower, reasoning consumption was higher, and verbosity was inconsistent. Haiku 3.5 is unusable on the tested subscription route despite being advertised.

Highest-impact follow-up is evidence discovery for vague intent: let OpenCode obtain a small, relevant set of actual indexed candidates without relying on whole-query lexical matches. Then enforce exact-path grounding and explicit inability to verify current facts when retrieval is empty. Benchmark these same queries again before changing defaults. Native shortcut/focus, actual app launches, DPI, startup/uninstall and real outage recovery remain separate release gates.

The opt-in benchmark runner is typechecked but never run by CI. Raw answers, paths, fixtures and timing rows are saved locally under ignored .cache; this public report omits unrelated project names. A sanitized measurement artifact accompanies the report. All created sessions were removed (zero remaining and zero cleanup errors), and the isolated host was stopped. The installed bar, startup and shared proxies were not changed.

Validation: 23 unit/reliability tests (88 assertions), strict typecheck including
the benchmark runner, client syntax check, 11 fake-host native lifecycle checks,
native helper compilation and eight headless Edge interaction tests all passed.
