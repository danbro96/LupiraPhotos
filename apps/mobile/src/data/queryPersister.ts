import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import Storage from 'expo-sqlite/kv-store';

export const queryPersister = createAsyncStoragePersister({ storage: Storage, key: 'lupira.photos.queryCache' });
