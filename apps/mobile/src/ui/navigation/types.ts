import type { PhotoQueryFilters } from '../../state/usePhotoLibrary';

export type RootStackParamList = {
  Login: undefined;
  /** Local day bounds, 'yyyy-MM-dd' — how a map pin hands over "everything from this day"; `event`
   *  is how an event hands over its linked photos, `photo` how a link hands over one photo. */
  Photos: { from?: string; to?: string; event?: string; photo?: string } | undefined;
  Settings: undefined;
  PhotoSettings: undefined;
  /** Reachable from Login too — switching to the LAN preset must not require signing in first. */
  Developer: undefined;
  DebugLog: undefined;
  /** Filters ride the route so the viewer's paging query hits the grid's cache entry, not the network. */
  PhotoViewer: { photoId: string; filters?: PhotoQueryFilters };
};
