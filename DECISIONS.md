# Decision Log

## 1. Deterministic core instead of an LLM-first assistant

**Decision:** Parse supported intents and execute structured catalog/spec tools.

**Why:** The source data is structured. Deterministic execution produces repeatable answers, exact evidence, low latency, no token cost, and no hallucinated APIs.

**Alternative:** Put the catalog/specs into an LLM prompt or RAG pipeline.

**Why not chosen:** It adds operational dependencies and nondeterminism without improving the core calculations. It also makes scenario verification harder.

## 2. Hybrid natural-language interpretation

**Decision:** Use transparent intent patterns plus catalog-aware matching and safe fallback clarification.

**Why:** The ten scenarios can be handled reliably within one day, and unsupported requests fail safely.

**Alternative:** Full grammar, embeddings, or an LLM router.

**Trade-off:** The current interpreter has narrower language coverage. The scaling plan describes replacing it with a constrained semantic router.

## 3. Rubric-driven quality engine

**Decision:** Load rubric metadata from `rubric.json`, with one evaluator per rule ID.

**Why:** Rule names, categories, and severities remain data-driven while executable semantics stay testable in code.

**Alternative:** Hard-code the full rubric or ask an LLM to judge each spec.

**Trade-off:** Subjective rules require documented heuristics. Evidence is surfaced so users can review the judgment.

## 4. Weighted all-or-nothing rule scoring

**Decision:** A rule earns its severity weight only when no violation is detected.

**Why:** This is simple, explainable, and consistent with a rubric containing rule-level severity rather than per-instance points.

**Alternative:** Deduct points per violation or partially pass rules.

**Trade-off:** One small violation can have the same rule-level effect as many. A future rubric could define caps and partial credit.

## 5. Preloaded local data

**Decision:** Load catalog, rubric, and specs once at startup.

**Why:** The provided dataset is small and static, giving fast requests and simple deployment.

**Alternative:** Read files on every request or use a database.

**Trade-off:** File changes require restart. The scaling plan adds ingestion, persistence, and incremental recomputation.

## 6. Explainable ambiguity handling

**Decision:** Return candidate APIs and a concrete clarification question.

**Why:** “Billing API” and the search/checkout scenario cannot be answered safely from the supplied artifacts. The assistant states the conflict rather than inventing a mapping.
