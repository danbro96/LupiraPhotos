import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => onlineManager.isOnline());
}
