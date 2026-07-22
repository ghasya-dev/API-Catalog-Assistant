# Scaling Plan

## Target architecture

1. **Ingestion service** receives catalog events and spec changes from Git/webhooks.
2. **Object storage** keeps immutable original specs by content hash.
3. **PostgreSQL** stores canonical API metadata, ownership, versions, dependencies, and quality reports.
4. **OpenSearch/Elasticsearch** provides full-text, faceted, and fuzzy discovery.
5. **Vector index** is optional for semantic discovery over descriptions, tags, and operation text.
6. **Worker queue** parses and assesses changed specs asynchronously.
7. **Query API** executes structured filters and graph queries.
8. **Constrained assistant router** maps natural language to typed tool calls and cites records used.

## Thousands of APIs

- Index domain, status, owner, protocol, gateway, onboarded date, and tags.
- Paginate and cap result sets.
- Store aliases and normalized search fields.
- Use a graph table or graph database for transitive dependency impact.
- Precompute reverse dependencies and strongly connected components.
- Apply tenant/environment authorization before retrieval.

## Hundreds or thousands of specs

- Parse once on ingestion and cache by SHA-256 hash.
- Re-run only when a spec, referenced component, evaluator version, or rubric version changes.
- Parallelize assessments through a queue with idempotent jobs.
- Persist rule-level evidence to support filtering and trend dashboards.
- Use a standards-compliant resolver for multi-file and external references.

## Reliability and observability

- Add request IDs, structured logs, metrics, distributed traces, and audit records.
- Track intent confidence, clarification rate, zero-result rate, evaluator duration, and rule failure trends.
- Add circuit breakers for optional LLM/search dependencies.
- Use golden scenario tests and versioned evaluator fixtures in CI.

## Security and governance

- Authenticate users and authorize access by catalog domain/spec sensitivity.
- Redact secrets before indexing.
- Disable unrestricted remote `$ref` fetching to prevent SSRF.
- Sign assessment artifacts and retain rubric/evaluator versions.
- Integrate quality gates into pull requests and API onboarding workflows.

## LLM extension

An LLM can be added as a planner only. It should emit a validated JSON tool request, receive minimal authorized results, and produce an answer with evidence. It should never be the source of catalog facts or quality scores.
