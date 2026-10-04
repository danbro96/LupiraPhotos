import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = new URL('.', import.meta.url).pathname;
const read = (p: string) => JSON.parse(readFileSync(join(here, p), 'utf8'));

const merged = read('../../openapi/LupiraPhotosBff.json');

const schemas = merged.components.schemas as Record<string, unknown>;
const paths = Object.keys(merged.paths) as string[];

// A path is proxied iff its operations carry an upstream's tag, which the merge sets per cluster.
const UPSTREAM_TAGS = new Set(['cal', 'geo', 'photo']);
const isProxied = (path: string) =>
  Object.values(merged.paths[path] as Record<string, { tags?: string[] }>)
    .some((op) => (op?.tags ?? []).some((t) => UPSTREAM_TAGS.has(t)));
const exposedFile = read('../../src/LupiraPhotosBff/exposed.json') as {
  clusters: Record<string, { prefix: string }>;
  operations: Record<string, string[]>;
};
const exposed = exposedFile.operations;

describe('the exposed allowlist', () => {
  it('is the whole of the merged surface — nothing rides along', () => {
    const allowed = new Set(
      Object.entries(exposed).flatMap(([cluster, ops]) =>
        ops.map((op) => {
          const [verb, path] = op.split(' ');
          return `${verb} ${exposedFile.clusters[cluster].prefix}${path}`;
        }),
      ),
    );
    const actual = Object.entries(merged.paths)
      .filter(([path]) => isProxied(path))
      .flatMap(([path, item]) =>
        Object.keys(item as object)
          .filter((verb) => verb !== 'parameters')
          .map((verb) => `${verb.toUpperCase()} ${path}`),
      );
    expect(actual.filter((op) => !allowed.has(op))).toEqual([]);
    expect(actual).toHaveLength(allowed.size);
  });

  // These reach a different credential than the family session the BFF holds, or aren't a browser
  // surface at all. An allowlist should already exclude them; this fails loudly if one is re-added.
  it('never exposes ingest, share-links, the user directory or liveness probes', () => {
    const forbidden = /^\/[a-z-]+\/(pingz|ingest|shared|shares|users)(\/|$)/;
    expect(paths.filter((p) => forbidden.test(p))).toEqual([]);
  });
});

describe('merged BFF spec', () => {
  // Everything is either proxied under a cluster prefix or declared by the BFF itself. The second
  // kind is how an endpoint migrates off the proxy, so it must not be mistaken for a stray path.
  it('separates the paths the BFF declares itself from the proxied ones', () => {
    expect(paths.filter((p) => !isProxied(p)).sort()).toEqual(['/auth/user']);
    // Every proxied path still sits under its cluster's mount.
    const prefixes = Object.values(exposedFile.clusters).map((c) => `${c.prefix}/`);
    expect(paths.filter(isProxied).filter((p) => !prefixes.some((x) => p.startsWith(x)))).toEqual([]);
  });

  it('has no duplicate operationIds', () => {
    const ids = Object.values(merged.paths as Record<string, Record<string, { operationId?: string }>>)
      .flatMap((item) => Object.values(item).map((op) => op?.operationId).filter(Boolean));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('leaves no schema unreachable from a path', () => {
    const refs = new Set<string>();
    JSON.stringify(merged).replace(/"#\/components\/schemas\/([^"]+)"/g, (_m, n: string) => (refs.add(n), _m));
    expect(Object.keys(schemas).filter((n) => !refs.has(n))).toEqual([]);
  });
});
