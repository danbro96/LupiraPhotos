import { describe, expect, it } from 'vitest';
import { withFilterParam } from './photoParams';

const params = (s: string) => new URLSearchParams(s);

describe('withFilterParam', () => {
  it('sets and clears a plain param without touching others', () => {
    expect(withFilterParam(params('kind=Photo'), 'sort', 'TakenAtAsc').toString()).toBe('kind=Photo&sort=TakenAtAsc');
    expect(withFilterParam(params('kind=Photo&sort=TakenAtAsc'), 'sort', undefined).toString()).toBe('kind=Photo');
  });

  it('drops near when place or located is set', () => {
    expect(withFilterParam(params('near=s1'), 'place', 'Torsby').toString()).toBe('place=Torsby');
    expect(withFilterParam(params('near=s1&kind=Video'), 'located', 'false').toString()).toBe('kind=Video&located=false');
  });

  it('drops place and located when near is set', () => {
    expect(withFilterParam(params('place=Torsby&located=true&kind=Video'), 'near', 's1').toString()).toBe('kind=Video&near=s1');
  });

  it('keeps near when an unrelated filter changes or a location filter is cleared', () => {
    expect(withFilterParam(params('near=s1'), 'kind', 'Photo').toString()).toBe('near=s1&kind=Photo');
    expect(withFilterParam(params('near=s1'), 'place', undefined).toString()).toBe('near=s1');
  });
});
