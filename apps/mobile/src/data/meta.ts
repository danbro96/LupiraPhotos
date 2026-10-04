import type { Tx } from '@danbro96/lupira-expo-sqlite/types';

export async function getMeta(tx: Tx, key: string): Promise<string | null> {
  const row = await tx.first<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setMeta(tx: Tx, key: string, value: string): Promise<void> {
  await tx.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}
