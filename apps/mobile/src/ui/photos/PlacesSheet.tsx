import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { photoCount } from '@lupira/photos-domain/photoFormat';
import { Sheet } from '@danbro96/lupira-expo-paper/components/Sheet';
import { PLACE_BROWSE_LIMIT } from '../../domain/geoPlaces';
import { useDebouncedValue } from '../../state/useDebouncedValue';
import { usePhotoPlaces } from '../../state/usePhotoLibrary';
import { TextField } from '@danbro96/lupira-expo-paper/components/TextField';
import { fieldGap } from '@danbro96/lupira-expo-paper/theme/styles';
import { useColors } from '../theme';
import { ICONS } from '../icons';

const SEARCH_DEBOUNCE_MS = 250;

/** The most photographed places by name, narrowed by a search; a tap filters the grid to that place. */
export function PlacesSheet({ onPick, onDismiss }: { onPick: (label: string) => void; onDismiss: () => void }) {
  const c = useColors();
  const [q, setQ] = useState('');
  const term = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS);
  const { data: places, isLoading } = usePhotoPlaces(term);

  return (
    <Sheet anchor="top" onDismiss={onDismiss}>
          <TextField style={fieldGap} label="Search places" autoFocus value={q} onChangeText={setQ} returnKeyType="search" />
          <ScrollView keyboardShouldPersistTaps="handled">
            {term.length === 0 && (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                {`Showing the ${PLACE_BROWSE_LIMIT} most photographed places — search for others`}
              </Text>
            )}
            {isLoading && <Text style={[styles.hint, { color: c.textMuted }]}>Looking…</Text>}
            {!isLoading && (places ?? []).length === 0 && term.length > 0 && (
              <Text style={[styles.hint, { color: c.textMuted }]}>No places match.</Text>
            )}
            {(places ?? []).map((p) => (
              <List.Item
                key={p.label}
                title={p.label}
                description={photoCount(p.count)}
                left={(props) => <List.Icon {...props} icon={ICONS.place} />}
                onPress={() => onPick(p.label)}
              />
            ))}
          </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, marginVertical: 12 },
});
