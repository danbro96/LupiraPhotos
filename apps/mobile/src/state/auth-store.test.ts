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
vi.mock('expo-auth-session', () => ({ fetchDiscoveryAsync: vi.fn() }));
vi.mock('@danbro96/lupira-expo-diagnostics/log', () => ({ logDebug: vi.fn() }));
vi.mock('@sentry/react-native', () => ({ setUser: vi.fn() }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: vi.fn(() => Promise.resolve('hash')) }));
vi.mock('../data/auth/oidc', () => ({ oidc: { refreshTokens: vi.fn() } }));

const tx = { run: vi.fn() };
vi.mock('../data/db/expoDb', () => ({ getDb: () => Promise.resolve({ exclusive: (fn: (t: typeof tx) => Promise<void>) => fn(tx) }) }));
vi.mock('./queryClient', () => ({ queryClient: { clear: vi.fn() } }));

import * as Sentry from '@sentry/react-native';
import { geoReady, useAuth } from './auth-store';
import { queryClient } from './queryClient';

const jwt = (claims: Record<string, unknown>) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe('auth store', () => {
  it('persists under lupira.photos.*, and a first sign-in wipes the read cache and the upload queue', async () => {
    await useAuth.getState().setSession({ accessToken: jwt({ email: 'user@test' }), refreshToken: 'rt-9', expiresIn: 3600 });

    expect(store.get('lupira.photos.refreshToken')).toBe('rt-9');
    expect(store.get('lupira.photos.userSub')).toBe('user@test');
    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(tx.run).toHaveBeenCalledWith('DELETE FROM photo_upload_queue');
    await vi.waitFor(() => expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'hash' }));
  });
});

describe('geoReady', () => {
  it('is true when the audience includes lupira-geo', () => {
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: ['lupira-photos-mobile', 'lupira-geo'] }) })).toBe(true);
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: 'lupira-geo' }) })).toBe(true);
  });

  it('is false without the lupira-geo audience or a token', () => {
    expect(geoReady({ authMode: 'oidc', token: jwt({ aud: ['lupira-photos-mobile', 'lupira-photo'] }) })).toBe(false);
    expect(geoReady({ authMode: 'oidc', token: null })).toBe(false);
  });

  it('is true in dev mode without a token', () => {
    expect(geoReady({ authMode: 'dev', token: null })).toBe(true);
  });
});
