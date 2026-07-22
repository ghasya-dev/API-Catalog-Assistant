import Fastify, { type FastifyInstance } from 'fastify';
import { DataStore } from './services/data-store.js';
import { CatalogService } from './services/catalog-service.js';
import { QualityService } from './services/quality-service.js';
import { AssistantService } from './services/assistant-service.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const store = new DataStore();
  await store.load();
  const catalog = new CatalogService(store);
  const quality = new QualityService(store);
  const assistant = new AssistantService(catalog, quality);

  app.get('/health', async () => ({ status: 'ok', apis: catalog.all().length, specs: store.getAllSpecs().length }));
  app.get('/catalog/apis', async (request) => {
    const query = request.query as { domain?: string; status?: string; tag?: string; owner?: string; protocol?: string; gateway?: string };
    const filtered = catalog.all().filter((api) =>
      (!query.domain || api.domain.toLowerCase() === query.domain.toLowerCase()) &&
      (!query.status || api.status.toLowerCase() === query.status.toLowerCase()) &&
      (!query.tag || api.tags.some((tag) => tag.toLowerCase() === query.tag!.toLowerCase())) &&
      (!query.owner || (api.owner ?? '').toLowerCase() === query.owner.toLowerCase()) &&
      (!query.protocol || api.protocol.toLowerCase() === query.protocol.toLowerCase()) &&
      (!query.gateway || (api.gateway ?? '').toLowerCase() === query.gateway.toLowerCase())
    );
    return { count: filtered.length, results: filtered };
  });
  app.get('/catalog/apis/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const api = catalog.findExact(name);
    if (!api) return reply.code(404).send({ error: 'API not found' });
    return { api, impact: catalog.dependencyImpact(api.name) };
  });
  app.get('/quality/:name', async (request, reply) => {
    const { name } = request.params as { name: string };
    const report = quality.assess(name);
    if (!report) return reply.code(404).send({ error: 'Spec not found' });
    return report;
  });
  app.get('/quality', async () => quality.rankAll());
  app.post('/assistant/query', {
    schema: {
      body: {
        type: 'object',
        required: ['question'],
        properties: { question: { type: 'string', minLength: 1, maxLength: 2000 } },
        additionalProperties: false,
      },
    },
  }, async (request) => assistant.answer((request.body as { question: string }).question));

  return app;
}
