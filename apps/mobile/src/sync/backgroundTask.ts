import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { logDebug } from '@danbro96/lupira-expo-diagnostics/log';
import { runPhotoBackup } from './photoUploader';

/** Best-effort while-backgrounded backup: WorkManager's 15-minute floor, further throttled by Doze and
 *  app-standby buckets — in practice hours, not minutes.
 *
 *  That makes background backup catch-up, NOT a Google-Photos-grade instant upload: the task's ~30 s
 *  budget fits a handful of photos, and a video may need several ticks (each retry resumes from the
 *  queue, so no work is lost). Bulk backup happens while the app is open. */
const TASK_NAME = 'lupira-photos-backup';

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    await runPhotoBackup();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    logDebug('photos', `background backup failed: ${String(e)}`);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundBackup(): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: 15 });
    logDebug('photos', 'background backup registered');
  } catch (e) {
    // Unavailable in Expo Go / misconfigured devices — foreground backup still covers everything.
    logDebug('photos', `background backup unavailable: ${String(e)}`);
  }
}
