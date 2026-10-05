import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView } from 'react-native';
import { List, Switch } from 'react-native-paper';
import { APP_VERSION } from '../../config';
import { UPDATE_LABEL } from '@danbro96/lupira-expo-diagnostics/buildInfo';
import { useAuth } from '../../state/auth-store';
import { usePhotoBackup } from '../../state/photo-backup-store';
import { usePrefs } from '../../state/prefs-store';
import { usePhotoBackupStatus } from '../../sync/photoBackupStatus';
import { IdentityHeader } from '@danbro96/lupira-expo-paper/components/IdentityHeader';
import { VersionLine } from '@danbro96/lupira-expo-paper/components/VersionLine';
import { ICONS } from '../icons';
import type { RootStackParamList } from '../navigation/types';
import { useColors } from '../theme';

const join = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ');

/** Identity, then one row per area with its state in the description, each opening its own screen. Something
 *  that needs you (a failed upload) shows in the warning colour, so nothing has to be opened to find it.
 *  Developer tooling stays behind the debug switch. */
export function SettingsScreen() {
  const c = useColors();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { authMode, user } = useAuth();
  const prefs = usePrefs();
  const photos = usePhotoBackup();
  const photoStatus = usePhotoBackupStatus();

  const chevron = () => <List.Icon icon={ICONS.chevronRight} />;
  const icon = (name: string) => (p: { color: string; style?: object }) => <List.Icon {...p} icon={name} />;
  const attention = { color: c.warning };

  const photoAttention = photos.settings.enabled && photoStatus.parked > 0;
  const photo = !photos.settings.enabled ? 'Off' : join(
    'On',
    photos.settings.wifiOnly && 'Wi-Fi only',
    photoStatus.pending > 0 ? `${photoStatus.pending} waiting` : `${photoStatus.done} backed up`,
    photoStatus.parked > 0 && `${photoStatus.parked} failed`,
  );

  return (
    <ScrollView>
      <IdentityHeader
        name={authMode === 'dev' ? 'Dev auto-auth' : user?.name ?? user?.sub ?? 'Signed out'}
        sub={authMode === 'dev' ? 'No sign-in' : user?.name ? user.sub : undefined}
      />

      <List.Subheader>Backup</List.Subheader>
      <List.Item
        title="Photo backup"
        description={photo}
        descriptionStyle={photoAttention ? attention : undefined}
        left={icon(ICONS.photos)}
        right={chevron}
        onPress={() => navigation.navigate('PhotoSettings')}
      />

      <List.Subheader>Developer</List.Subheader>
      <List.Item
        title="Enable debug"
        description="Developer tools and the on-device log"
        left={icon(ICONS.tools)}
        right={() => (
          <Switch
            value={prefs.debugEnabled}
            onValueChange={(v) => void usePrefs.getState().setDebugEnabled(v)}
            accessibilityLabel="Enable debug"
          />
        )}
      />
      {prefs.debugEnabled && (
        <List.Item title="Developer options" left={icon(ICONS.tune)} right={chevron} onPress={() => navigation.navigate('Developer')} />
      )}

      <List.Subheader>About</List.Subheader>
      <VersionLine app="Lupira Photos" version={APP_VERSION} updateLabel={UPDATE_LABEL} />
    </ScrollView>
  );
}
