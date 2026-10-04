import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../../state/auth-store';
import { SettingsButton } from '@danbro96/lupira-expo-paper/components/SettingsButton';
import { DebugLogScreen } from '@danbro96/lupira-expo-diagnostics/DebugLogScreen';
import { DeveloperScreen } from '../screens/DeveloperScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PhotosScreen } from '../screens/PhotosScreen';
import { PhotoViewerScreen } from '../screens/PhotoViewerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { PhotoSettingsScreen } from '../screens/PhotoSettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack() {
  const authed = useAuth((s) => s.authMode === 'dev' || s.token !== null);
  return (
    <Stack.Navigator>
      {authed ? (
        <Stack.Screen name="Photos" component={PhotosScreen} options={{ title: 'Photos', headerRight: () => <SettingsButton /> }} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="PhotoSettings" component={PhotoSettingsScreen} options={{ title: 'Photo backup' }} />
      <Stack.Screen name="DebugLog" component={DebugLogScreen} options={{ title: 'Debug log' }} />
      <Stack.Screen name="PhotoViewer" component={PhotoViewerScreen} options={{ title: 'Photo' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ title: 'Developer' }} />
    </Stack.Navigator>
  );
}
