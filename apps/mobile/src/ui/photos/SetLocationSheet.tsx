import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';
import { formatCoords } from '@danbro96/lupira-domain-places/places';
import { MIN_PLACE_QUERY } from '@danbro96/lupira-domain-places/placeCandidates';
import { fmtWhen } from '@danbro96/lupira-domain-core/time';
import { displayTitle } from '@danbro96/lupira-domain-events/itemLabels';
import { PHOTO_TEXT } from '@danbro96/lupira-domain-photos/photoLinks';
import { photoCount } from '@lupira/photos-domain/photoFormat';
import { measuredCount, needsOverwriteConfirm, type LocationState } from '@lupira/photos-domain/photoLocation';
import { targetFromPlace, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { Button } from '@danbro96/lupira-expo-paper/components/Button';
import { ChoiceChips } from '@danbro96/lupira-expo-paper/components/ChoiceChips';
import { useConfirm } from '@danbro96/lupira-expo-paper/components/ConfirmDialog';
import { Sheet } from '@danbro96/lupira-expo-paper/components/Sheet';
import { TextField } from '@danbro96/lupira-expo-paper/components/TextField';
import { groupTargets, overwriteWarning } from '../../domain/geoPlaces';
import { useGeoReady } from '../../state/auth-store';
import { relocate } from '../../state/photoActions';
import {
  isGeoDenied, useAddressSearch, useEventPlace, useGeoSuggestions, useSavedPlaces, useSavedTargets,
} from '../../state/useGeoPlaces';
import { useLinkCandidates } from '../../state/usePhotoEventLinks';
import { useOnline } from '../../state/useOnline';
import { useColors } from '../theme';
import { ICONS } from '../icons';
import { GeoBanner } from './GeoBanner';

type Photo = LocationState & { takenAt: string };

/** One place for a single photo or a selection: a saved place, a search hit, an address, or an event's place. */
export function SetLocationSheet({ photos, onDismiss, onDone }: {
  photos: readonly Photo[];
  onDismiss: () => void;
  onDone?: () => void;
}) {
  const c = useColors();
  const confirm = useConfirm();
  const online = useOnline();
  const geoReady = useGeoReady();
  const [q, setQ] = useState('');
  const [addressTerm, setAddressTerm] = useState('');
  const [chosen, setChosen] = useState<PlaceTarget | null>(null);
  const [eventPick, setEventPick] = useState<{ placeId: string; title: string } | null>(null);
  const [pickingEvent, setPickingEvent] = useState(false);
  const [busy, setBusy] = useState(false);

  const saved = useSavedPlaces();
  const { targets: savedTargets, settled } = useSavedTargets(saved.data ?? []);
  const suggestions = useGeoSuggestions(q);
  const addresses = useAddressSearch(addressTerm);
  const candidates = useLinkCandidates(photos.map((p) => p.takenAt), pickingEvent);
  const eventPlace = useEventPlace(eventPick?.placeId);

  const term = q.trim();
  const searching = term.length >= MIN_PLACE_QUERY;
  const denied = !geoReady || [saved.error, suggestions.error, addresses.error, eventPlace.error].some(isGeoDenied);
  const savedOptions = (saved.data ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ value: `saved:${s.id}`, label: s.label }));
  const groups = groupTargets(savedTargets, searching ? (suggestions.data ?? []) : [], searching ? (addresses.data ?? []) : []);
  const eventTarget = eventPick && eventPlace.data ? targetFromPlace(eventPlace.data, eventPick.title) : null;
  const target = eventPick ? eventTarget : chosen;
  const eventPending = !!eventPick && eventPlace.isLoading;

  const preview = target
    ? `${photoCount(photos.length)} → ${target.label} (${formatCoords(target.latitude, target.longitude)})`
    : eventPending ? 'Looking up the event’s place…'
    : eventPick ? 'That event’s place has no coordinates.'
    : 'Pick a place.';

  const onPick = (next: PlaceTarget | null) => {
    setChosen(next);
    setEventPick(null);
  };
  const onApply = async () => {
    if (!target) return;
    if (needsOverwriteConfirm(photos)) {
      const ok = await confirm({
        title: 'Replace the position?',
        message: overwriteWarning(measuredCount(photos)),
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    setBusy(true);
    const attempted = await relocate(photos, target);
    setBusy(false);
    if (!attempted) return;
    onDone?.();
    onDismiss();
  };

  const targetItem = (t: PlaceTarget, icon: string) => (
    <List.Item
      key={t.key}
      title={t.label}
      description={t.detail}
      left={(props) => <List.Icon {...props} icon={icon} />}
      right={(props) => (target?.key === t.key ? <List.Icon {...props} icon={ICONS.check} /> : null)}
      disabled={busy}
      onPress={() => onPick(t)}
    />
  );

  return (
    <Sheet
      title={photos.length === 1 ? 'Set location' : `Set location · ${photoCount(photos.length)}`}
      onDismiss={busy ? noop : onDismiss}
    >
          {denied && <GeoBanner />}
          <ScrollView keyboardShouldPersistTaps="handled">
            {savedOptions.length > 0 && (
              <>
                <Text style={[styles.label, { color: c.textMuted }]}>Saved places</Text>
                <ChoiceChips
                  options={savedOptions}
                  value={chosen?.source === 'saved' && !eventPick ? chosen.key : ''}
                  onChange={(key) => onPick(savedTargets.find((t) => t.key === key) ?? null)}
                />
              </>
            )}

            <TextField
              style={styles.search}
              label="Search places"
              value={q}
              onChangeText={(text) => {
                setQ(text);
                setAddressTerm('');
              }}
              returnKeyType="search"
            />
            {groups.places.length > 0 && <List.Subheader>Places</List.Subheader>}
            {groups.places.map((t) => targetItem(t, ICONS.place))}
            {searching && !denied && (
              <>
                {groups.addresses.length > 0 && <List.Subheader>Addresses</List.Subheader>}
                {groups.addresses.map((t) => targetItem(t, ICONS.map))}
                {addressTerm === term && addresses.isFetching && (
                  <Text style={[styles.muted, { color: c.textMuted }]}>Searching addresses…</Text>
                )}
                {addressTerm === term && addresses.isSuccess && groups.addresses.length === 0 && (
                  <Text style={[styles.muted, { color: c.textMuted }]}>No addresses found.</Text>
                )}
                {addressTerm !== term && (
                  <List.Item
                    title={`Search addresses for “${term}”`}
                    left={(props) => <List.Icon {...props} icon={ICONS.search} />}
                    onPress={() => setAddressTerm(term)}
                  />
                )}
              </>
            )}

            <Button
              title="Place of an event…"
              variant="text"
              onPress={() => setPickingEvent((v) => !v)}
            />
            {pickingEvent && candidates.isLoading && <Text style={[styles.muted, { color: c.textMuted }]}>Looking…</Text>}
            {pickingEvent && !candidates.isLoading && (candidates.data ?? []).length === 0 && (
              <Text style={[styles.muted, { color: c.textMuted }]}>{PHOTO_TEXT.noEventsAround}</Text>
            )}
            {pickingEvent && (candidates.data ?? []).map((item) => (
              <List.Item
                key={item.id}
                title={displayTitle(item.title)}
                description={item.placeId ? (item.locationLabel ?? fmtWhen(item.start, item.isAllDay)) : 'No place on this event'}
                left={(props) => <List.Icon {...props} icon={ICONS.calendar} />}
                disabled={busy || !item.placeId}
                onPress={() => {
                  setEventPick({ placeId: item.placeId!, title: displayTitle(item.title) });
                  setPickingEvent(false);
                }}
              />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={[styles.preview, { color: c.text }]}>{preview}</Text>
            {!online && <Text style={[styles.muted, { color: c.warning }]}>Setting a location needs a connection.</Text>}
            <Button
              title="Set location"
              disabled={!target || busy || !online || (target.source === 'saved' && !settled)}
              loading={busy}
              onPress={() => void onApply()}
            />
          </View>
    </Sheet>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  label: { fontSize: 12, marginTop: 8, marginBottom: 4 },
  search: { flex: 0, marginTop: 12 },
  muted: { fontSize: 13, marginVertical: 8 },
  footer: { gap: 6, paddingTop: 8 },
  preview: { fontSize: 14 },
});
