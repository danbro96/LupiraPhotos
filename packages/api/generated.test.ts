import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(new URL('.', import.meta.url).pathname, 'src/generated');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const queryFiles = walk(join(root, 'query'));
const keys = queryFiles.flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/^\s+`(\/[^`]*)`/gm)].map((m) => m[1]),
);

describe('generated client', () => {
  it('has no duplicate react-query keys', () => {
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  // Anything not under a cluster prefix is an endpoint the BFF declares itself, which is how one
  // migrates off the proxy.
  it('routes every proxied key through a cluster prefix', () => {
    const prefixes = ['/api/', '/geo-api/', '/photo-api/'];
    expect(keys.filter((k) => !prefixes.some((p) => k.startsWith(p)))).toEqual(['/auth/user']);
  });

  it('generates both flavours over one set of models', () => {
    const tags = ['cal', 'geo', 'lupira-photos-bff', 'photo'];
    for (const dir of ['query', 'fetch']) {
      // Directories only: orval also writes an index.ts barrel beside them.
      const entries = readdirSync(join(root, dir), { withFileTypes: true });
      expect(entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()).toEqual(tags);
    }
    // Both import types from the shared models dir rather than carrying their own copy.
    for (const f of [...queryFiles, ...walk(join(root, 'fetch'))]) {
      expect(readFileSync(f, 'utf8')).not.toMatch(/from '\.\.\/\.\.\/\.\.\/models/);
    }
  });
});
