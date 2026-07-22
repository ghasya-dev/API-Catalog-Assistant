import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Catalog, Rubric } from '../types/models.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');

export class DataStore {
  private catalog?: Catalog;
  private rubric?: Rubric;
  private specs = new Map<string, Record<string, any>>();

  async load(): Promise<void> {
    this.catalog = JSON.parse(await readFile(path.join(DATA_DIR, 'catalog.json'), 'utf8')) as Catalog;
    this.rubric = JSON.parse(await readFile(path.join(DATA_DIR, 'rubric.json'), 'utf8')) as Rubric;
    const specDir = path.join(DATA_DIR, 'specs');
    const files = (await readdir(specDir)).filter((file) => /\.ya?ml$/i.test(file));
    for (const file of files) {
      const parsed = parseYaml(await readFile(path.join(specDir, file), 'utf8')) as Record<string, any>;
      this.specs.set(file.replace(/\.ya?ml$/i, ''), parsed);
    }
  }

  getCatalog(): Catalog {
    if (!this.catalog) throw new Error('DataStore not loaded');
    return this.catalog;
  }

  getRubric(): Rubric {
    if (!this.rubric) throw new Error('DataStore not loaded');
    return this.rubric;
  }

  getSpec(name: string): Record<string, any> | undefined {
    return this.specs.get(name.replace(/\.ya?ml$/i, '').toLowerCase());
  }

  getAllSpecs(): Array<{ name: string; spec: Record<string, any> }> {
    return [...this.specs.entries()].map(([name, spec]) => ({ name, spec }));
  }
}
