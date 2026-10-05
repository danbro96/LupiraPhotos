import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '0.0.0' } } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
  setItemAsync: vi.fn((k: string, v: string) => {
    store.set(k, v);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((k: string) => {
    store.delete(k);
    return Promise.resolve();
  }),
}));
vi.mock('@danbro96/lupira-expo-diagnostics/log', () => ({ logDebug: vi.fn() }));
vi.mock('@sentry/react-native', () => ({ setUser: vi.fn() }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: vi.fn(() => Promise.resolve('hash')) }));

const refreshTokensMock = vi.fn();
vi.mock('../data/auth/oidc', () => ({ oidc: { refreshTokens: (rt: string) => refreshTokensMock(rt) } }));
vi.mock('@danbro96/lupira-expo-oidc/oidc', () => {
  class RefreshError extends Error {
    constructor(readonly definitive: boolean, message: string) {
      super(message);
    }
  }
  return {
    RefreshError,
    decodeJwt: (t: string) => {
      const payload = t.split('.')[1];
      return payload ? JSON.parse(Buffer.from(payload, 'base64url').toString()) : { email: 'user@test' };
    },
  };
});

import { RefreshError } from '@danbro96/lupira-expo-oidc/oidc';
import { geoReady, useAuth } from './auth-store';

function seedSession(expiresInMs: number) {
  useAuth.setState({
    loaded: true,
    authMode: 'oidc',
    token: 'tok-1',
    refreshToken: 'rt-1',
    expiresAt: Date.now() + expiresInMs,
    user: { sub: 'user@test' },
  });
}

beforeEach(() => {
  store.clear();
  refreshTokensMock.mockReset();
  useAuth.setState({ loaded: false, token: null, refreshToken: null, expiresAt: 0, user: null, authMode: 'oidc' });
});

describe('refreshIfNeeded', () => {
  it('stands pat on a fresh token without a forced refresh', async () => {
    seedSession(3_600_000);
    expect(await useAuth.getState().refreshIfNeeded()).toBe('tok-1');
    expect(refreshTokensMock).not.toHaveBeenCalled();
  });

  it('coalesces concurrent refreshes into one token-endpoint call', async () => {
    seedSession(10_000);   // inside the expiry margin → both callers want a refresh
    let release!: (v: unknown) => void;
    refreshTokensMock.mockReturnValue(new Promise((r) => { release = r; }));

    const a = useAuth.getState().refreshIfNeeded();
    const b = useAuth.getState().refreshIfNeeded();
    release({ accessToken: 'tok-2', refreshToken: 'rt-2', expiresIn: 3600 });

    expect(await a).toBe('tok-2');
    expect(await b).toBe('tok-2');
    expect(refreshTokensMock).toHaveBeenCalledTimes(1);
  });

  it('is rotation-safe: a 401 about an already-replaced token does not rotate again', async () => {
    seedSession(3_600_000);
    useAuth.setState({ token: 'tok-2', refreshToken: 'rt-2' });   // someone already rotated past tok-1

    const result = await useAuth.getState().refreshIfNeeded({ force: true, sentToken: 'tok-1' });
    expect(result).toBe('tok-2');
    expect(refreshTokensMock).not.toHaveBeenCalled();
  });

  it('a forced refresh still POSTs when sentToken matches the current token', async () => {
    seedSession(3_600_000);
    refreshTokensMock.mockResolvedValue({ accessToken: 'tok-2', refreshToken: 'rt-2', expiresIn: 3600 });

    expect(await useAuth.getState().refreshIfNeeded({ force: true, sentToken: 'tok-1' })).toBe('tok-2');
    expect(refreshTokensMock).toHaveBeenCalledWith('rt-1');
  });

  it('concurrent 401s carrying the same sentToken share one POST', async () => {
    seedSession(3_600_000);
    let release!: (v: unknown) => void;
    refreshTokensMock.mockReturnValue(new Promise((r) => { release = r; }));

    const a = useAuth.getState().refreshIfNeeded({ force: true, sentToken: 'tok-1' });
    const b = useAuth.getState().refreshIfNeeded({ force: true, sentToken: 'tok-1' });
    release({ accessToken: 'tok-2', refreshToken: 'rt-2', expiresIn: 3600 });

    expect([await a, await b]).toEqual(['tok-2', 'tok-2']);
    expect(refreshTokensMock).toHaveBeenCalledTimes(1);
  });

  it('signs out on a forced refresh with no refresh token, and limps along unforced', async () => {
    seedSession(10_000);
    useAuth.setState({ refreshToken: null });
    expect(await useAuth.getState().refreshIfNeeded()).toBe('tok-1');
    expect(await useAuth.getState().refreshIfNeeded({ force: true })).toBeNull();
    expect(useAuth.getState().token).toBeNull();
    expect(refreshTokensMock).not.toHaveBeenCalled();
  });

  it('clears the session on a definitive failure', async () => {
    seedSession(10_000);
    refreshTokensMock.mockRejectedValue(new RefreshError(true, 'invalid_grant'));

    expect(await useAuth.getState().refreshIfNeeded({ force: true })).toBeNull();
    expect(useAuth.getState().token).toBeNull();
    expect(useAuth.getState().refreshToken).toBeNull();
  });

  it('keeps the session on a transient failure and returns the same token', async () => {
    seedSession(10_000);
    refreshTokensMock.mockRejectedValue(new RefreshError(false, '503'));

    expect(await useAuth.getState().refreshIfNeeded({ force: true })).toBe('tok-1');
    expect(useAuth.getState().token).toBe('tok-1');
  });

  it('sends nothing in dev auto-auth mode', async () => {
    useAuth.setState({ loaded: true, authMode: 'dev', token: null, refreshToken: null });
    expect(await useAuth.getState().refreshIfNeeded({ force: true })).toBeNull();
    expect(refreshTokensMock).not.toHaveBeenCalled();
  });
});

describe('session persistence', () => {
  it('round-trips a session through the secure store', async () => {
    useAuth.setState({ loaded: true, authMode: 'oidc' });
    await useAuth.getState().setSession({ accessToken: 'tok-9', refreshToken: 'rt-9', expiresIn: 3600 });

    useAuth.setState({ loaded: false, token: null, refreshToken: null, expiresAt: 0, user: null });
    await useAuth.getState().load();

    const s = useAuth.getState();
    expect(s.token).toBe('tok-9');
    expect(s.refreshToken).toBe('rt-9');
    expect(s.user?.sub).toBe('user@test');
  });

  it('persists under the lupira.photos.* keys and a definitive failure wipes them', async () => {
    useAuth.setState({ loaded: true, authMode: 'oidc' });
    await useAuth.getState().setSession({ accessToken: 'tok-9', refreshToken: 'rt-9', expiresIn: 3600 });

    expect([...store.keys()].sort()).toEqual(
      ['lupira.photos.expiresAt', 'lupira.photos.refreshToken', 'lupira.photos.token', 'lupira.photos.userSub'],
    );
    expect(store.get('lupira.photos.token')).toBe('tok-9');
    expect(store.get('lupira.photos.refreshToken')).toBe('rt-9');

    refreshTokensMock.mockRejectedValue(new RefreshError(true, 'invalid_grant'));
    await useAuth.getState().refreshIfNeeded({ force: true });
    expect([...store.keys()]).toEqual([]);
  });

  it('keeps the previous refresh token when the endpoint rotates without issuing one', async () => {
    seedSession(10_000);
    refreshTokensMock.mockResolvedValue({ accessToken: 'tok-2', refreshToken: null, expiresIn: 3600 });

    await useAuth.getState().refreshIfNeeded({ force: true });
    expect(useAuth.getState().refreshToken).toBe('rt-1');
  });
});

describe('geoReady', () => {
  const jwt = (claims: Record<string, unknown>) =>
    `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

  it('is true when the audience array includes lupira-geo', () => {
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: ['lupira-photos-mobile', 'lupira-geo'] }) })).toBe(true);
  });

  it('is true when the audience is the lupira-geo string', () => {
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: 'lupira-geo' }) })).toBe(true);
  });

  it('is false without the lupira-geo audience', () => {
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: ['lupira-photos-mobile', 'lupira-photo'] }) })).toBe(false);
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: 'lupira-photo' }) })).toBe(false);
    expect(geoReady({ authMode: 'oidc', token: jwt({}) })).toBe(false);
  });

  it('is false with no token or an undecodable one', () => {
    expect(geoReady({ authMode: 'oidc', token: null })).toBe(false);
    expect(geoReady({ authMode: 'oidc', token: 'not-a-jwt' })).toBe(false);
  });

  it('is true in dev mode without a token', () => {
    expect(geoReady({ authMode: 'dev', token: null })).toBe(true);
  });
});
