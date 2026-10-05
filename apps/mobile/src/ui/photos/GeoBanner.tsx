import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '@danbro96/lupira-expo-paper/components/Button';
import { useAuth } from '../../state/auth-store';
import { useColors } from '../theme';

/** Place search needs the geo audience, which a session minted before that scope existed does not carry. */
export function GeoBanner() {
  const c = useColors();
  return (
    <View style={styles.root}>
      <Text style={[styles.text, { color: c.warning }]}>Sign out and in again to search places.</Text>
      <Button title="Sign out" variant="text" onPress={() => void useAuth.getState().clearSession()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  text: { flex: 1, fontSize: 13 },
});
