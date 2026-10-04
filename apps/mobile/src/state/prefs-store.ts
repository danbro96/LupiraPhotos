import { create } from 'zustand';
import { getDb } from '../data/db/expoDb';
import { getMeta, setMeta } from '../data/meta';

/** Small user preferences, persisted in the meta table (shared ground the data layer can read, and no
 *  brittle SecureStore key destructuring). */

const DEBUG_KEY = 'prefs.debugEnabled';

type Prefs = {
  loaded: boolean;
  /** Gates the Developer + debug-log entries in Settings. */
  debugEnabled: boolean;
};

type PrefsActions = {
  init(): Promise<void>;
  setDebugEnabled(value: boolean): Promise<void>;
};

export const usePrefs = create<Prefs & PrefsActions>((set) => ({
  loaded: false,
  debugEnabled: false,

  init: async () => {
    const db = await getDb();
    set({ debugEnabled: (await getMeta(db, DEBUG_KEY)) === '1', loaded: true });
  },

  setDebugEnabled: async (value) => {
    set({ debugEnabled: value });
    const db = await getDb();
    await db.exclusive((tx) => setMeta(tx, DEBUG_KEY, value ? '1' : '0'));
  },
}));
