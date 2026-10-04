import type { AppHosts } from '@danbro96/lupira-domain-links/appLinks';
import Constants from 'expo-constants';

export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export const REQUEST_TIMEOUT_MS = 10_000;

/** 'dev' = this backend's bypass; here that means sending nothing (the BFF's DevAuthHandler). */
export type AuthMode = 'oidc' | 'dev';

/** `urls.api` is the primary origin; multi-backend apps add keys. */
export type ApiPreset = {
  key: string;
  label: string;
  urls: { api: string } & Record<string, string>;
  authMode: AuthMode;
};

export const API_PRESETS: ApiPreset[] = [
  { key: 'prod', label: 'Production', urls: { api: 'https://photos.lupira.com' }, authMode: 'oidc' },
  { key: 'lan', label: 'LAN dev', urls: { api: 'http://192.168.14.108:5183' }, authMode: 'dev' },
  { key: 'emulator', label: 'Emulator dev', urls: { api: 'http://10.0.2.2:5183' }, authMode: 'dev' },
];

export const API_URL_STORAGE_KEY = 'lupira.photos.apiUrl';

// Build-time default; the settings screen persists a runtime override on top.
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? API_PRESETS[0].urls.api;
export const DEFAULT_AUTH_MODE: AuthMode =
  (process.env.EXPO_PUBLIC_AUTH_MODE as AuthMode | undefined)
  ?? (process.env.EXPO_PUBLIC_API_URL ? 'dev' : 'oidc');

// Sentry DSN — a public ingest key, safe to commit. Empty disables reporting.
export const SENTRY_DSN = '';

/** Extra screens the Developer screen links to. */
export const DIAGNOSTIC_ROUTES: { route: string; label: string }[] = [
  { route: 'DebugLog', label: 'Debug log' },
];

export const SIBLING_WEB_HOSTS: AppHosts = {
  cal: 'https://cal.lupira.com',
  maps: 'https://maps.lupira.com',
  photos: 'https://photos.lupira.com',
  tasks: 'https://tasks.lupira.com',
};
