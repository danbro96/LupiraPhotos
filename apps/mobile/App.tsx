import type { LinkingOptions } from '@react-navigation/native';
import { NavigationContainer } from '@react-navigation/native';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from './src/state/auth-store';
import { ConfirmDialogHost } from '@danbro96/lupira-expo-paper/components/ConfirmDialog';
import { ToastHost } from '@danbro96/lupira-expo-paper/components/ToastHost';
import { navDark, navLight, paperDark, paperLight } from './src/ui/theme/paperTheme';
import { usePhotoBackup } from './src/state/photo-backup-store';
import { usePrefs } from './src/state/prefs-store';
import { persistOptions, queryClient } from './src/state/queryClient';
import { registerBackgroundBackup } from './src/sync/backgroundTask';
import { startPhotoBackup } from './src/sync/photoUploader';
import { RootStack } from './src/ui/navigation/RootStack';
import { useAutoUpdate } from '@danbro96/lupira-expo-diagnostics/useAutoUpdate';
import type { RootStackParamList } from './src/ui/navigation/types';
import { paperSettings } from '@danbro96/lupira-expo-paper/theme/paperSettings';
import { SENTRY_DSN } from './src/config';
import { initSentry } from '@danbro96/lupira-expo-diagnostics/initSentry';

initSentry(SENTRY_DSN);

export default function App() {
  useAutoUpdate();
  const scheme = useColorScheme();
  const loaded = useAuth((s) => s.loaded);
  const authed = useAuth((s) => s.authMode === 'dev' || s.token !== null);

  useEffect(() => {
    void useAuth.getState().load();
  }, []);

  useEffect(() => {
    if (!loaded || !authed) return;
    void registerBackgroundBackup();
    void usePrefs.getState().init();
    void usePhotoBackup.getState().init();
    return startPhotoBackup();
  }, [loaded, authed]);

  if (!loaded) return null;   // hydration gate — avoids a login flash over a persisted session
  return (
    // GestureHandlerRootView must be the outermost view or the photo viewer's pinch gesture never fires.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <SafeAreaProvider>
          <PaperProvider theme={scheme === 'dark' ? paperDark : paperLight} settings={paperSettings}>
            <ConfirmDialogHost>
              <NavigationContainer linking={linking} theme={scheme === 'dark' ? navDark : navLight}>
                <StatusBar style="auto" />
                <RootStack />
              </NavigationContainer>
            </ConfirmDialogHost>
            <ToastHost />
          </PaperProvider>
        </SafeAreaProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

/// Deep links from the sibling apps, in both the path and the query form. The OIDC redirect
/// (lupiraphotos://oauthredirect) matches nothing here and is ignored by navigation.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['lupiraphotos://'],
  config: {
    initialRouteName: 'Photos',
    screens: {
      Photos: { path: '', alias: ['event/:event'] },
      PhotoViewer: 'photo/:photoId',
    },
  },
};
