import type { Finding, QualityReport, RubricRule, Severity } from '../types/models.js';
import { DataStore } from './data-store.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);
const WEIGHTS: Record<Severity, number> = { low: 1, medium: 2, high: 4 };

interface OperationRef { path: string; method: string; operation: Record<string, any>; pathItem: Record<string, any> }

function operations(spec: Record<string, any>): OperationRef[] {
  const out: OperationRef[] = [];
  for (const [route, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
      if (HTTP_METHODS.has(method.toLowerCase()) && operation && typeof operation === 'object') {
        out.push({ path: route, method: method.toLowerCase(), operation: operation as Record<string, any>, pathItem: pathItem as Record<string, any> });
      }
    }
  }
  return out;
}

function schemas(spec: Record<string, any>): Array<{ name: string; schema: Record<string, any> }> {
  return Object.entries(spec.components?.schemas ?? {}).map(([name, schema]) => ({ name, schema: schema as Record<string, any> }));
}

function hasExample(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if ('example' in node || (node.examples && Object.keys(node.examples).length > 0)) return true;
  if (node.schema && ('example' in node.schema || (node.schema.examples && node.schema.examples.length > 0))) return true;
  return false;
}

function responseEntries(operation: Record<string, any>): Array<[string, any]> {
  return Object.entries(operation.responses ?? {});
}

function hasResponseBody(response: any): boolean {
  return Boolean(response?.content && Object.keys(response.content).length > 0);
}

function contentSchemas(response: any): any[] {
  return Object.values(response?.content ?? {}).map((media: any) => media?.schema).filter(Boolean);
}

function typedSchema(schema: any): boolean {
  if (!schema || typeof schema !== 'object') return false;
  if (schema.$ref || schema.oneOf || schema.anyOf || schema.allOf) return true;
  if (schema.type === 'array') return typedSchema(schema.items);
  if (schema.type === 'object') return Boolean(schema.properties && Object.keys(schema.properties).length > 0) || Boolean(schema.additionalProperties);
  return Boolean(schema.type);
}

function isCamelCase(name: string): boolean { return /^[a-z][A-Za-z0-9]*$/.test(name); }
function isSafePath(route: string): boolean {
  if (route !== '/' && route.endsWith('/')) return false;
  return route.split('/').filter(Boolean).every((segment) => {
    if (/^\{[^}]+\}$/.test(segment)) return true;
    return /^[a-z][a-z0-9-]*$/.test(segment) && !/^(get|create|update|delete|list|fetch|set)[A-Z-]?/i.test(segment);
  });
}

function scalarStrings(value: any, path = ''): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => scalarStrings(child, `${path}/${key}`));
}

function looksSensitive(path: string, value: string): boolean {
  const key = path.toLowerCase();
  const sensitiveKey = /(authorization|token|secret|api[-_]?key|password|ssn|socialsecurity|creditcard|cardnumber)/.test(key);
  if (!sensitiveKey) return false;
  if (/^(example|sample|test|placeholder|redacted|xxx|\*+)$/i.test(value)) return false;
  return value.length >= 8 || /\d{3}-\d{2}-\d{4}/.test(value);
}

export class QualityService {
  constructor(private readonly store: DataStore) {}

  assess(apiName: string): QualityReport | undefined {
    const spec = this.store.getSpec(apiName);
    if (!spec) return undefined;
    const rubric = this.store.getRubric();
    const rules = rubric.categories.flatMap((category) => category.rules.map((rule) => ({ category: category.name, rule })));
    const findings = rules.map(({ category, rule }) => this.evaluate(rule, category, spec));
    const max = findings.reduce((sum, f) => sum + WEIGHTS[f.severity], 0);
    const earned = findings.reduce((sum, f) => sum + (f.passed ? WEIGHTS[f.severity] : 0), 0);
    const score = Math.round((earned / max) * 100);
    return {
      api: apiName,
      file: `data/specs/${apiName}.yaml`,
      score,
      grade: score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Needs improvement' : 'Poor',
      passedRules: findings.filter((f) => f.passed).length,
      failedRules: findings.filter((f) => !f.passed).length,
      findings,
    };
  }

  rankAll(): QualityReport[] {
    return this.store.getAllSpecs()
      .map(({ name }) => this.assess(name)!)
      .sort((a, b) => b.score - a.score || a.api.localeCompare(b.api));
  }

  private evaluate(rule: RubricRule, category: string, spec: Record<string, any>): Finding {
    const ops = operations(spec);
    let evidence: string[] = [];
    let recommendation = '';

    switch (rule.id) {
      case 'DOC-01':
        evidence = ops.filter(({ operation }) => !String(operation.summary ?? '').trim() || !String(operation.description ?? '').trim())
          .map(({ method, path, operation }) => `${method.toUpperCase()} ${path}: missing ${!String(operation.summary ?? '').trim() && !String(operation.description ?? '').trim() ? 'summary and description' : !String(operation.summary ?? '').trim() ? 'summary' : 'description'}`);
        recommendation = 'Add a concise summary and a useful description to every operation.';
        break;
      case 'DOC-02': {
        for (const { method, path, operation, pathItem } of ops) {
          for (const parameter of [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]) {
            if (!String(parameter?.description ?? '').trim()) evidence.push(`${method.toUpperCase()} ${path}: parameter '${parameter?.name ?? 'unknown'}' has no description`);
          }
        }
        for (const { name, schema } of schemas(spec)) {
          for (const [property, definition] of Object.entries(schema.properties ?? {})) {
            if (!String((definition as any)?.description ?? '').trim()) evidence.push(`Schema ${name}.${property} has no description`);
          }
        }
        recommendation = 'Describe every parameter and schema property, including business meaning and constraints.';
        break;
      }
      case 'DOC-03':
        for (const { method, path, operation } of ops) {
          if (operation.requestBody) {
            const media = Object.values(operation.requestBody.content ?? {});
            if (!media.some(hasExample)) evidence.push(`${method.toUpperCase()} ${path}: request body has no example`);
          }
          for (const [status, response] of responseEntries(operation).filter(([code]) => /^2\d\d$/.test(code))) {
            if (hasResponseBody(response) && !Object.values(response.content ?? {}).some(hasExample)) evidence.push(`${method.toUpperCase()} ${path}: ${status} response has no example`);
          }
        }
        recommendation = 'Add representative request and successful-response examples under each media type.';
        break;
      case 'SEC-01':
        if (!spec.components?.securitySchemes || Object.keys(spec.components.securitySchemes).length === 0) evidence.push('components.securitySchemes is missing or empty');
        recommendation = 'Define an authentication scheme such as OAuth2, bearer JWT, API key, or mutual TLS under components.securitySchemes.';
        break;
      case 'SEC-02': {
        const globalSecurity = Array.isArray(spec.security) && spec.security.length > 0;
        for (const { method, path, operation } of ops) {
          const explicitPublic = Array.isArray(operation.security) && operation.security.length === 0;
          const secured = Array.isArray(operation.security) ? operation.security.length > 0 : globalSecurity;
          if (!secured && !explicitPublic) evidence.push(`${method.toUpperCase()} ${path}: no security requirement and not explicitly public`);
        }
        recommendation = 'Apply a global security requirement or operation-level security; use security: [] only for intentionally public operations.';
        break;
      }
      case 'SEC-03': {
        for (const server of spec.servers ?? []) if (!String(server?.url ?? '').startsWith('https://')) evidence.push(`Unsafe server URL: ${server?.url ?? '(missing)'}`);
        for (const item of scalarStrings(spec)) if (looksSensitive(item.path, item.value)) evidence.push(`Potential sensitive example at ${item.path}`);
        recommendation = 'Use HTTPS for every server and replace realistic secrets or PII in examples with clearly synthetic values.';
        break;
      }
      case 'DES-01':
        evidence = Object.keys(spec.paths ?? {}).filter((route) => !isSafePath(route)).map((route) => `Inconsistent path: ${route}`);
        recommendation = 'Use lowercase, hyphenated, plural resource nouns; avoid verbs, underscores, and trailing slashes.';
        break;
      case 'DES-02':
        for (const { name, schema } of schemas(spec)) {
          for (const property of Object.keys(schema.properties ?? {})) if (!isCamelCase(property)) evidence.push(`Schema ${name} uses non-camelCase property '${property}'`);
        }
        recommendation = 'Rename schema properties to one convention, preferably camelCase, and version breaking changes.';
        break;
      case 'DES-03': {
        const ids = new Map<string, string[]>();
        for (const { method, path, operation } of ops) {
          const id = String(operation.operationId ?? '').trim();
          if (!id) evidence.push(`${method.toUpperCase()} ${path}: missing operationId`);
          else ids.set(id, [...(ids.get(id) ?? []), `${method.toUpperCase()} ${path}`]);
        }
        for (const [id, locations] of ids) if (locations.length > 1) evidence.push(`Duplicate operationId '${id}' at ${locations.join(', ')}`);
        recommendation = 'Give every operation a stable, unique operationId suitable for generated clients.';
        break;
      }
      case 'CMP-01':
        for (const { method, path, operation } of ops) {
          const codes = responseEntries(operation).map(([code]) => code);
          if (!codes.some((code) => /^4\d\d$/.test(code))) evidence.push(`${method.toUpperCase()} ${path}: no 4xx response`);
          if (['post', 'put', 'patch', 'delete'].includes(method) && !codes.some((code) => /^5\d\d$/.test(code))) evidence.push(`${method.toUpperCase()} ${path}: mutating operation has no 5xx response`);
        }
        recommendation = 'Document relevant 4xx responses for every operation and at least one 5xx response for mutating operations.';
        break;
      case 'CMP-02':
        for (const { method, path, operation } of ops) {
          for (const [status, response] of responseEntries(operation).filter(([code]) => /^2\d\d$/.test(code))) {
            if (!hasResponseBody(response)) {
              if (!['204', '205'].includes(status)) evidence.push(`${method.toUpperCase()} ${path}: ${status} has no typed content`);
            } else if (contentSchemas(response).some((schema) => !typedSchema(schema))) {
              evidence.push(`${method.toUpperCase()} ${path}: ${status} contains an untyped or empty schema`);
            }
          }
        }
        recommendation = 'Attach an explicit schema or $ref to every successful response body; use 204 for intentionally empty responses.';
        break;
      case 'CMP-03':
        if (!String(spec.info?.version ?? '').trim()) evidence.push('info.version is missing');
        if (!String(spec.info?.title ?? '').trim()) evidence.push('info.title is missing');
        if (!spec.info?.contact || Object.keys(spec.info.contact).length === 0) evidence.push('info.contact is missing');
        if (!Array.isArray(spec.servers) || spec.servers.length === 0) evidence.push('servers is missing or empty');
        recommendation = 'Provide title, version, contact details, and at least one server URL.';
        break;
      default:
        evidence = [`Rule ${rule.id} is not implemented`];
        recommendation = 'Implement this rubric rule.';
    }

    const limited = evidence.slice(0, 12);
    if (evidence.length > limited.length) limited.push(`...and ${evidence.length - limited.length} more`);
    return { ruleId: rule.id, title: rule.title, category, severity: rule.severity, passed: evidence.length === 0, evidence: evidence.length ? limited : ['No violations found'], ...(evidence.length ? { recommendation } : {}) };
  }
}
