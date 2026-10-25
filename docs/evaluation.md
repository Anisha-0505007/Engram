# Evaluation status

**Not measured yet.** The previous 60% / 100% / 100% table had no saved expected item IDs or reproducible run evidence and has been removed.

Create `docs/eval-cases.json` containing at least 25 entries of this shape, using actual IDs from a dedicated evaluation account:

```json
[
  { "query": "wifi plan screenshot", "expectedItemIds": ["actual_24_character_item_id"] }
]
```

Include exact words, synonyms, image text, PDF text, dates, categories and ambiguous queries. Keep the same saved items and queries for all three modes.

Set `EVAL_EMAIL`, `EVAL_PASSWORD` and optionally `EVAL_BASE_URL` in the invoking shell, then run from `server/`:

```
node scripts/evaluate.mjs ../docs/eval-cases.json
```

The runner logs in through the real API, requests keyword-only, vector-only and hybrid results, and writes this file only after every request succeeds without dependency warnings. Allow a sufficient daily AI budget for the whole run. It measures **top-5 hit rate**, not recall across multiple relevant items. Atlas indexes and completed enrichment are prerequisites.

RRF combines ranks; it does **not** guarantee that hybrid beats either input. Report the measurements even when hybrid performs worse.
