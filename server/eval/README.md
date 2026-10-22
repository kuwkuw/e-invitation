# LLM eval and model probe

The unit suite mocks the LLM boundary, so it says nothing about whether the
prompts and the routed models still produce a usable invitation. These two
commands ask real providers.

```sh
pnpm --filter inv-app-server probe   # is every routed model reachable?
pnpm --filter inv-app-server eval    # does the pipeline still produce good output?
```

Both read keys from `server/.env`, like the dev server. CI runs them in
`.github/workflows/llm-eval.yml`: nightly, and on PRs touching
`server/src/pipeline/`, `server/src/llm/`, `schemas.ts` or this folder.

## Probe

One tiny structured-output request to every model in `routing.ts`, through
the real gateway path. A primary that fails (or has no key) fails the run;
production is on fallbacks right now. A fallback that fails is reported, and
fails only with `--strict`. This is the check `/healthz` cannot make: it sees
key presence, not a model that was retired or moved to a paid tier.

## Eval

Runs each sentence in `cases.ts` through brief extraction, and the top
`--generate N` (default 6) through the full pipeline, then applies the checks
in `checks.ts`:

| Stage | Checks |
|---|---|
| Brief | language; event type; hosts; date, time, venue, city copied as written, or `null` when not stated; extra details present or absent |
| Copy | no empty field; no placeholder; written in the brief's language; no number the sentence did not contain (an invented year or date); stated date, time and venue kept; a stated host named; title length |

The report lists **which model served every call**. A run can pass every check
while every call went to a fallback, which is exactly how the 2026-09-12 Groq
change went unnoticed, so `--strict-routing` (used nightly) fails on any fallback.

| Flag | Default | |
|---|---|---|
| `--generate N` | 6 | Cases run through copy + design (Gemini quota, see below) |
| `--only a,b` | all | Run only these case ids |
| `--model id` | real routing | Pin every task to one model, no fallbacks. Try a replacement here before changing `routing.ts` |
| `--strict-routing` | off | Fail if any call was served by a fallback |
| `--min-brief` / `--min-copy` | 0.9 / 0.85 | Pass rates below which the run fails |
| `--concurrency N` | 1 | Cases in parallel |
| `--pace-ms N` | 8000 | Minimum gap between case starts, to stay under per-minute limits |
| `--retries N` | 3 | Retries for a case whose primary was rate-limited, waiting as long as the provider asks |
| `--max-unscored` | 0.1 | Share of cases still rate-limited after retries above which the run fails as inconclusive |
| `--out file` | none | JSON report: every output, check and call |

Exit codes: `0` pass, `1` below threshold, routing degraded or too many unscored cases, `2` cannot run (missing key, unknown model).

### Rate limits are not quality

The free tiers limit requests and tokens **per minute** as well as per day.
The first CI run sent two cases at a time and hit Groq's per-minute limit
after 13 briefs. Every later case then failed in seconds, and Gemini's limit
went with it, because the gateway falls through to Gemini on a 429 exactly as
it does in production. The run scored 43% and measured nothing about the
prompts.

So the eval paces itself (one case every 8 s), and when the **primary** model
is refused for quota it waits as long as the provider's 429 says ("try again
in 3.48s") and retries the case. The fallback answer from the refused attempt
is discarded, because it is the eval's own traffic and not what the run set
out to measure. A case still refused after its retries is reported as
**rate-limited, not scored**, kept apart from quality failures, and too many
of those fail the run as inconclusive. A primary that fails for any other
reason (auth, connectivity, unusable output) is real degradation: it is scored,
and `--strict-routing` fails on the fallback that answered.

### Quota

A default run is about 47 Groq calls (40 briefs, 6 designs and the probe)
and about 7 Gemini calls (6 copies and the probe), and takes about 6 minutes
because of the pacing. Gemini's free tier is about
20 a day, so **CI uses its own keys, not production's**, and `--generate`
stays small. Run a larger `--generate` with a paid or BYOK-scale key.

## Adding a case

Add it to `cases.ts`. Expect only what the sentence says: a substring or stem
for what it states, `null` for what it does not. `test/evalChecks.test.ts`
fails a case that expects text absent from its own input. Give it a
`generateRank` only if it is worth one of the few full-generation slots.
When production shows a bad output, its sentence belongs here.
