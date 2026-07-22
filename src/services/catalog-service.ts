import type { CatalogApi } from '../types/models.js';
import { DataStore } from './data-store.js';

const normalize = (value: string): string => value.toLowerCase().trim().replace(/[\s_]+/g, '-');
const active = (api: CatalogApi): boolean => !['deprecated', 'retired'].includes(api.status.toLowerCase());

export class CatalogService {
  constructor(private readonly store: DataStore) {}

  all(): CatalogApi[] { return this.store.getCatalog().apis; }

  findExact(name: string): CatalogApi | undefined {
    const n = normalize(name);
    return this.all().find((api) => normalize(api.name) === n);
  }

  findCandidates(term: string): CatalogApi[] {
    const q = normalize(term).replace(/-api$/, '');
    return this.all().filter((api) => {
      const fields = [api.name.replace(/-api$/, ''), api.domain, ...api.tags].map(normalize);
      return fields.some((field) => field.includes(q) || q.includes(field));
    });
  }

  paymentProduction(): CatalogApi[] {
    return this.all().filter((api) =>
      (api.domain.toLowerCase() === 'payments' || api.tags.some((t) => t.toLowerCase() === 'payments')) &&
      api.status.toLowerCase() === 'production'
    );
  }

  directDependents(name: string): CatalogApi[] {
    return this.all().filter((api) => api.dependencies.some((dep) => normalize(dep) === normalize(name)));
  }

  dependencyImpact(name: string): { direct: CatalogApi[]; transitive: CatalogApi[] } {
    const direct = this.directDependents(name);
    const seen = new Set(direct.map((api) => api.name));
    const queue = [...direct];
    while (queue.length) {
      const current = queue.shift()!;
      for (const dependent of this.directDependents(current.name)) {
        if (!seen.has(dependent.name)) {
          seen.add(dependent.name);
          queue.push(dependent);
        }
      }
    }
    return { direct, transitive: this.all().filter((api) => seen.has(api.name) && !direct.some((d) => d.name === api.name)) };
  }

  externalWithoutGateway(): CatalogApi[] {
    return this.all().filter((api) => api.tags.some((t) => t.toLowerCase() === 'external') && !api.gateway);
  }

  deprecatedWithActiveDependents(): Array<{ deprecatedApi: CatalogApi; dependents: CatalogApi[] }> {
    return this.all()
      .filter((api) => api.status.toLowerCase() === 'deprecated')
      .map((deprecatedApi) => ({
        deprecatedApi,
        dependents: this.directDependents(deprecatedApi.name).filter(active),
      }))
      .filter((item) => item.dependents.length > 0);
  }

  shippingSmsFlow(): CatalogApi[] {
    const names = ['orders-api', 'shipping-api', 'notifications-api', 'sms-api', 'customer-api', 'customer-consent-api'];
    return names.map((name) => this.findExact(name)).filter((api): api is CatalogApi => Boolean(api));
  }
}
