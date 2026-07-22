declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: string): Promise<string>;
  export function readdir(path: string): Promise<string[]>;
  export function writeFile(path: string, data: string): Promise<void>;
}
declare module 'node:path' {
  const path: { resolve(...parts: string[]): string; join(...parts: string[]): string };
  export default path;
}
declare module 'yaml' { export function parse(input: string): Record<string, any>; }
declare module 'fastify' {
  export interface FastifyInstance {
    get(path: string, handler: (request: any, reply: any) => any): void;
    post(path: string, options: any, handler: (request: any, reply: any) => any): void;
    listen(options: any): Promise<void>;
    log: { error(error: unknown): void };
  }
  export default function Fastify(options?: any): FastifyInstance;
}
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};
declare const performance: { now(): number };
declare const console: { log(...args: unknown[]): void };
