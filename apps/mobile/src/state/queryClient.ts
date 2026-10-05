import { connectFocusManager } from '@danbro96/lupira-expo-query/focus';
import { connectOnlineManager } from '@danbro96/lupira-expo-query/online';
import { createAppQueryClient } from '@danbro96/lupira-expo-query/queryClient';
import { APP_VERSION } from '../config';

export const { queryClient, persistOptions } = createAppQueryClient({ persistRoots: ['photos'], buster: APP_VERSION });

connectOnlineManager();
connectFocusManager();

/** Every root: a photo write can change list, detail, stats, links and places alike. */
export function invalidatePhotos(): void {
  void queryClient.invalidateQueries();
}
