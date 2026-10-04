import { describe, expect, it } from 'vitest';
import { getGetItemQueryKey, getListRelationEdgesQueryKey, getSearchItemsQueryKey } from '@lupira/photos-api/query/cal';
import { getGetPhotoQueryKey, getGetPhotoStatsQueryKey, getListPhotoPlacesQueryKey, getListPhotosQueryKey } from '@lupira/photos-api/query/photo';

// The predicates in useInvalidate match generated keys by prefix, and those keys are the BFF's
// paths. Nothing else asserts that the two agree: a prefix that stops matching invalidates nothing,
// which typechecks, passes every other test, and only shows up as a stale screen after a mutation.
// These pin the real generated keys against the real predicate strings.
const first = (k: readonly unknown[]) => String(k[0]);

const photos = (key: string) => key.startsWith('/photo-api/photos') || key.startsWith('/api/relations/edges');

describe('invalidation predicates match the generated keys', () => {
  it('photos matches every gallery query and the edge map', () => {
    expect(photos(first(getListPhotosQueryKey()))).toBe(true);
    expect(photos(first(getGetPhotoQueryKey('abc')))).toBe(true);
    expect(photos(first(getGetPhotoStatsQueryKey()))).toBe(true);
    expect(photos(first(getListPhotoPlacesQueryKey()))).toBe(true);
    expect(photos(first(getListRelationEdgesQueryKey()))).toBe(true);
  });

  it('photos does NOT reach into calendar items', () => {
    expect(photos(first(getSearchItemsQueryKey()))).toBe(false);
    expect(photos(first(getGetItemQueryKey('abc')))).toBe(false);
  });
});
