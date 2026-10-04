import NetInfo from '@react-native-community/netinfo';
import { defaultShouldDehydrateQuery, focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';
import { ApiError } from '@danbro96/lupira-http/apiError';
import { APP_VERSION } from '../config';
import { queryPersister } from '../data/queryPersister';

const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (s) => handleFocus(s === 'active'));
  return () => sub.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: PERSIST_MAX_AGE_MS,
      staleTime: 60_000,
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status >= 400 && error.status < 500 ? false : failureCount < 2,
    },
  },
});

const PERSISTED = new Set(['list', 'detail', 'stats', 'places']);

const isPersisted = (query: Query) =>
  query.queryKey[0] === 'photos' && PERSISTED.has(String(query.queryKey[1])) && defaultShouldDehydrateQuery(query);

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  buster: APP_VERSION,
  dehydrateOptions: { shouldDehydrateQuery: isPersisted },
};

export function invalidatePhotos(): void {
  void queryClient.invalidateQueries({ queryKey: ['photos'] });
}
