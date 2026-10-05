/** One location filter at a time: `near` is a bbox over the same photos `place` and `located` select. */
const LOCATION_FILTERS = ['place', 'located', 'near'];

export function withFilterParam(prev: URLSearchParams, key: string, value: string | undefined): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (!value) {
    next.delete(key);
    return next;
  }
  next.set(key, value);
  if (LOCATION_FILTERS.includes(key)) for (const other of LOCATION_FILTERS) if (other !== key) next.delete(other);
  return next;
}
