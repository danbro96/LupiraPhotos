import { DeveloperScreen as DiagnosticsScreen } from '@danbro96/lupira-expo-diagnostics/DeveloperScreen';
import { API_PRESETS, DIAGNOSTIC_ROUTES } from '../../config';
import { useAuth } from '../../state/auth-store';
import { usePhotoBackupStatus } from '../../sync/photoBackupStatus';
import { toastError } from '@danbro96/lupira-expo-feedback/toast';

/** Reachable from Settings and from the login screen (switching backends must not require signing in first). */
export function DeveloperScreen() {
  const { apiUrl, authMode } = useAuth();
  const backup = usePhotoBackupStatus();
  return (
    <DiagnosticsScreen
      presets={API_PRESETS}
      diagnosticRoutes={DIAGNOSTIC_ROUTES}
      apiUrl={apiUrl}
      authMode={authMode}
      onSelectBackend={(urls, mode) => { useAuth.getState().setBackend(urls, mode).catch(() => toastError('Could not switch the backend.')); }}
      customUrlPlaceholder="http://host:5183"
      syncState={backup}
    />
  );
}
