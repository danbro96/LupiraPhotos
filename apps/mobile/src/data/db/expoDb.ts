import { expoDb } from '@danbro96/lupira-expo-sqlite/expoDb';
import { migrate } from '@danbro96/lupira-expo-sqlite/migrate';
import type { Db } from '@danbro96/lupira-expo-sqlite/types';
import { MIGRATIONS } from './schema';

const open = expoDb('lupira-photos.db', { serializeStatements: true });

let ready: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  ready ??= open().then(async (db) => {
    await migrate(db, MIGRATIONS);
    return db;
  }).catch((e: unknown) => {
    ready = null;
    throw e;
  });
  return ready;
}
