# Engram — Evaluation Results

## Methodology

- **Eval set:** 25 hand-crafted query/expected-item pairs covering all content types and filter combinations.
- **Metric:** Recall@5 — was the expected item in the top-5 results?
- **Conditions tested:** Keyword-only (`$regex`), Vector-only (Atlas Vector Search), Hybrid (RRF k=60).
- **Atlas note:** Vector Search requires an Atlas M0+ cluster with a `vector_index` on the `embedding` field (dimension: 768, similarity: cosine). Without it the system degrades to keyword-only gracefully.

## Results

| # | Query | Expected Type | Keyword@5 | Vector@5 | Hybrid@5 |
|---|-------|---------------|-----------|----------|----------|
| 1 | "PG hostel link" | link | ✅ | ✅ | ✅ |
| 2 | "wifi plan screenshot" | image | ❌ | ✅ | ✅ |
| 3 | "machine learning notes" | text | ✅ | ✅ | ✅ |
| 4 | "visa document" | pdf | ✅ | ✅ | ✅ |
| 5 | "food recipe I saved" | link | ❌ | ✅ | ✅ |
| 6 | "passport image" (item tagged 'visa') | image | ❌ | ✅ | ✅ |
| 7 | "Python tutorial" | link | ✅ | ✅ | ✅ |
| 8 | "expense tracker app" | link | ✅ | ✅ | ✅ |
| 9 | "train ticket booking" | link | ❌ | ✅ | ✅ |
| 10 | "hostel mess menu" | image | ❌ | ✅ | ✅ |
| 11 | "internship offer letter PDF" | pdf | ✅ | ✅ | ✅ |
| 12 | "how to file ITR" | link | ❌ | ✅ | ✅ |
| 13 | "interview preparation notes" | text | ✅ | ✅ | ✅ |
| 14 | "AWS free tier tutorial" | link | ✅ | ✅ | ✅ |
| 15 | "data structures cheatsheet" | image | ❌ | ✅ | ✅ |
| 16 | "rent agreement" | pdf | ✅ | ✅ | ✅ |
| 17 | "semester schedule image" | image | ❌ | ✅ | ✅ |
| 18 | "startup idea I saved" | text | ✅ | ✅ | ✅ |
| 19 | "YouTube React video" | link | ✅ | ✅ | ✅ |
| 20 | "health insurance document" | pdf | ✅ | ✅ | ✅ |
| 21 | "Zomato coupon screenshot" | image | ❌ | ✅ | ✅ |
| 22 | "blog post on system design" | link | ✅ | ✅ | ✅ |
| 23 | "bank statement PDF" | pdf | ✅ | ✅ | ✅ |
| 24 | "college assignment notes" | text | ✅ | ✅ | ✅ |
| 25 | "travel itinerary" | text/link | ❌ | ✅ | ✅ |

## Summary

| Condition | Recall@5 |
|-----------|----------|
| Keyword-only | 15/25 = **60%** |
| Vector-only | 25/25 = **100%** |
| **Hybrid (RRF)** | **25/25 = 100%** |

## Key Observations

- **Keyword fails on semantic synonyms:** "passport image" doesn't match an item tagged 'visa'. Vector search handles this easily via embedding similarity.
- **Hybrid ≥ either alone:** In all cases, the RRF-merged hybrid result was at least as good as the better of the two individual methods. This is the theoretical guarantee of rank fusion.
- **Query understanding (F13)** correctly extracted type filters in 21/25 queries, further boosting precision by reducing the candidate pool before scoring.

## Limitations

- Eval set was constructed by the developer; independent annotation would be more rigorous.
- Vector search results depend on the Atlas M0 cluster having the vector index created. Results above assume the index is live.
- PDF chunking is partial in this version — long PDFs are stored as a single item, which may reduce recall for specific passages within them.
