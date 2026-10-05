import * as Sentry from '@sentry/react-native';
import * as Crypto from 'expo-crypto';
import { createAuthStore, type AuthState } from '@danbro96/lupira-expo-oidc/authStore';
import { hasAudience } from '@danbro96/lupira-expo-oidc/oidc';
import { logDebug } from '@danbro96/lupira-expo-diagnostics/log';
import { DEFAULT_API_URL, DEFAULT_AUTH_MODE } from '../config';
import { oidc } from '../data/auth/oidc';
import { getDb } from '../data/db/expoDb';
import { wipeUploadQueue } from '../data/photoQueue';
import { queryClient } from './queryClient';

/** Pseudonymous Sentry identity: SHA-256 of the email (sendDefaultPii is off). Null clears it. */
async function setSentryUser(sub: string | null): Promise<void> {
  if (!sub) {
    Sentry.setUser(null);
    return;
  }
  try {
    Sentry.setUser({ id: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sub) });
  } catch {
    // Leave it unset rather than risk sending the raw email.
  }
}

export const useAuth = createAuthStore({
  keyPrefix: 'lupira.photos',
  defaultApiUrl: DEFAULT_API_URL,
  defaultAuthMode: DEFAULT_AUTH_MODE,
  oidc,
  log: logDebug,
  onAccountChange: async () => {
    queryClient.clear();
    const db = await getDb();
    await db.exclusive(wipeUploadQueue);
  },
});

useAuth.subscribe((s, prev) => { if (s.user?.sub !== prev.user?.sub) void setSentryUser(s.user?.sub ?? null); });

export const geoReady = (s: Pick<AuthState, 'authMode' | 'token'>) => s.authMode === 'dev' || hasAudience(s.token, 'lupira-geo');

export const useGeoReady = () => useAuth(geoReady);
