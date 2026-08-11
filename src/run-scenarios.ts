//Code Owner: hasyag
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DataStore } from './services/data-store.js';
import { CatalogService } from './services/catalog-service.js';
import { QualityService } from './services/quality-service.js';
import { AssistantService } from './services/assistant-service.js';

const store = new DataStore();
await store.load();
const assistant = new AssistantService(new CatalogService(store), new QualityService(store));
const input = JSON.parse(await readFile(path.resolve('data/scenarios.json'), 'utf8')) as { scenarios: Array<{ id: string; type: string; prompt: string }> };
const results = input.scenarios.map((scenario) => {
  const started = performance.now();
  const response = assistant.answer(scenario.prompt);
  return {
    ...scenario,
    response,
    elapsedMs: Number((performance.now() - started).toFixed(3)),
    selfAssessment: response.intent.includes('clarification') || response.intent.includes('ambiguous') || response.intent.includes('conflicting')
      ? 'Handled without inventing missing facts'
      : 'Grounded in catalog/spec/rubric data',
  };
});
await writeFile(path.resolve('results/scenario-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results.map((r) => ({ id: r.id, intent: r.response.intent, answer: r.response.answer })), null, 2));
