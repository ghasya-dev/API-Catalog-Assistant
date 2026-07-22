import type { AssistantResponse, CatalogApi, QualityReport } from '../types/models.js';
import { CatalogService } from './catalog-service.js';
import { QualityService } from './quality-service.js';

const names = (apis: CatalogApi[]): string => apis.map((api) => api.name).join(', ');

export class AssistantService {
  constructor(private readonly catalog: CatalogService, private readonly quality: QualityService) {}

  answer(question: string): AssistantResponse {
    const q = question.toLowerCase().trim();

    if (/payment/.test(q) && /(production|ready)/.test(q)) {
      const matches = this.catalog.paymentProduction();
      return { intent: 'catalog_search', answer: `${matches.length} payment-related APIs are in production: ${names(matches)}.`, data: matches };
    }

    const dependsMatch = q.match(/what depends on (?:the )?([a-z0-9-_]+(?:-api)?)/i);
    if (dependsMatch) {
      const apiName = dependsMatch[1].endsWith('-api') ? dependsMatch[1] : `${dependsMatch[1]}-api`;
      const impact = this.catalog.dependencyImpact(apiName);
      return {
        intent: 'dependency_impact',
        answer: `${impact.direct.length} APIs directly depend on ${apiName}: ${names(impact.direct)}.${impact.transitive.length ? ` ${impact.transitive.length} additional APIs are transitively exposed: ${names(impact.transitive)}.` : ''}`,
        data: impact,
      };
    }

    if (/externally|external/.test(q) && /(not behind|without).*(gateway)|gateway/.test(q)) {
      const matches = this.catalog.externalWithoutGateway();
      return { intent: 'catalog_risk_query', answer: matches.length ? `${matches.length} externally tagged APIs have no gateway: ${names(matches)}.` : 'No externally tagged APIs lack a gateway.', data: matches };
    }

    if (/deprecated/.test(q) && /(depend|active)/.test(q)) {
      const matches = this.catalog.deprecatedWithActiveDependents();
      const summary = matches.map((m) => `${m.deprecatedApi.name} <- ${names(m.dependents)}`).join('; ');
      return { intent: 'deprecated_dependency_query', answer: matches.length ? `Deprecated APIs still used by active APIs: ${summary}.` : 'No deprecated APIs are directly used by active APIs.', data: matches };
    }

    if (/sms/.test(q) && /(order ships|ships|shipping)/.test(q)) {
      const matches = this.catalog.shippingSmsFlow();
      return {
        intent: 'solution_recommendation',
        answer: 'Use orders-api for the order, shipping-api for shipment status, notifications-api for orchestration/preferences, sms-api for delivery, and customer-api plus customer-consent-api for the phone number and consent.',
        data: matches,
        assumptions: ['A shipment event or polling integration can trigger the notification.', 'Customer consent must be checked before sending SMS.'],
      };
    }

    if (/rank/.test(q) && /spec/.test(q)) {
      const ranking = this.quality.rankAll();
      return { intent: 'quality_ranking', answer: ranking.map((r, i) => `${i + 1}. ${r.api} (${r.score})`).join('\n'), data: ranking };
    }

    const specMatch = q.match(/(?:wrong with|assess|quality of|security problems?.*|does the )\s*(?:the )?([a-z0-9-_]+-api)(?: spec)?/i)
      ?? q.match(/([a-z0-9-_]+-api) spec/i);
    if (specMatch) {
      const apiName = specMatch[1].toLowerCase();
      const report = this.quality.assess(apiName);
      if (!report) return { intent: 'spec_not_found', answer: `No OpenAPI spec was provided for ${apiName}.`, data: { availableSpecs: this.quality.rankAll().map((r) => r.api) } };
      const securityOnly = /security/.test(q);
      const findings = securityOnly ? report.findings.filter((f) => f.category === 'Security') : report.findings.filter((f) => !f.passed);
      return {
        intent: securityOnly ? 'security_assessment' : 'quality_assessment',
        answer: this.reportSummary(report, findings),
        data: { ...report, findings },
      };
    }

    if (/billing api/.test(q)) {
      const candidates = this.catalog.findCandidates('billing');
      return {
        intent: 'ambiguous_request',
        answer: '“Billing API” does not uniquely identify one catalog entry, and “good” could mean production status, dependency health, or OpenAPI quality.',
        clarification: { question: 'Which API and quality dimension do you mean?', candidates: candidates.map((api) => api.name) },
        data: candidates,
      };
    }

    if (/search service/.test(q) && /checkout endpoint/.test(q)) {
      const search = this.catalog.findExact('search-api');
      const checkout = this.catalog.findExact('checkout-api');
      return {
        intent: 'conflicting_request',
        answer: 'The request combines two different APIs: search-api is the search service, while checkout-api is the catalog entry associated with checkout. No search-api OpenAPI file was provided, and the checkout endpoint cannot be assumed to belong to search-api.',
        clarification: { question: 'Do you want search-api details or the checkout-api integration?', candidates: [search?.name, checkout?.name].filter(Boolean) as string[] },
        data: { search, checkout },
      };
    }

    const apiMentions = [...q.matchAll(/([a-z0-9-_]+-api)/g)].map((m) => m[1]);
    if (apiMentions.length === 1) {
      const api = this.catalog.findExact(apiMentions[0]);
      if (api) return { intent: 'api_details', answer: `${api.name} is a ${api.status} ${api.protocol} API in ${api.domain}, owned by ${api.owner ?? 'no recorded owner'}.`, data: api };
    }

    return {
      intent: 'clarification_required',
      answer: 'I could not map the request confidently to a supported catalog query or spec assessment.',
      clarification: { question: 'Which API, domain, status, dependency, or spec should I inspect?' },
    };
  }

  private reportSummary(report: QualityReport, findings: QualityReport['findings']): string {
    if (!findings.length) return `${report.api} scored ${report.score}/100 (${report.grade}); no relevant violations were found.`;
    return `${report.api} scored ${report.score}/100 (${report.grade}). Key issues: ${findings.map((f) => `${f.ruleId} ${f.title}`).join('; ')}.`;
  }
}
