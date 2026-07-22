# Failure Analysis

## Natural-language coverage

The intent parser recognizes the supplied scenarios and several common variations, but arbitrary phrasing may fall through to clarification. It can also misinterpret a sentence containing multiple competing intents.

**Mitigation:** Add a constrained LLM or embedding classifier that outputs a validated intent schema, then execute only deterministic tools. Maintain a regression set of real developer questions.

## Fuzzy entity resolution

Substring/tag matching can over-match broad terms such as “billing,” and typographical errors are only partly tolerated.

**Mitigation:** Add normalized aliases, edit-distance scoring, confidence thresholds, and user/team-curated synonyms. Never auto-select below threshold.

## Subjective rubric semantics

Rules such as “verbs in paths,” “real-looking PII,” and whether a successful response “clearly returns a body” require heuristics. The checker may produce false positives or negatives.

**Mitigation:** Version evaluator behavior, allow suppressions with rationale, add fixture-based tests, and expose evidence for human review.

## OpenAPI reference resolution

The checker handles inline schemas and local `$ref` presence but does not dereference external files or remote URLs. Circular/missing references are not validated.

**Mitigation:** Use a standards-compliant OpenAPI parser/bundler, resolve references in a sandbox, and report unresolved references separately.

## Non-HTTP specifications

The catalog includes Kafka, gRPC, MQTT, GraphQL, and SOAP APIs, while the supplied quality rubric is OpenAPI-specific. Only supplied YAML OpenAPI specs are assessed.

**Mitigation:** Route by protocol and use AsyncAPI, protobuf, GraphQL schema, or WSDL-specific rubrics.

## Dependency meaning

Catalog dependencies are treated as directed runtime dependencies. The data does not specify sync/async behavior, criticality, retries, fallbacks, or environment-specific topology. “What breaks” therefore means exposure, not guaranteed outage.

**Mitigation:** Add dependency type, criticality, runtime telemetry, service-level objectives, and environment/version metadata.

## Data freshness and consistency

The catalog contains inconsistent status casing (`production` and `Production`) and missing owners/gateways. The implementation normalizes comparisons but does not silently repair source records.

**Mitigation:** Add ingestion validation, canonical enums, ownership checks, and source-quality warnings.

## Security limits

Static spec checks cannot prove that runtime authentication, authorization, TLS, redaction, or gateway policy is correctly enforced.

**Mitigation:** Combine spec linting with gateway configuration inspection, dynamic tests, secret scanning, and runtime policy evidence.
