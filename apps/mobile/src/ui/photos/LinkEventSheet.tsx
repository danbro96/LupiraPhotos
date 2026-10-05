import { linkedMessage, linkPhotosTitle, PHOTO_TEXT } from '@danbro96/lupira-domain-photos/photoLinks';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { fmtWhen } from '@danbro96/lupira-domain-core/time';
import { displayTitle } from '@danbro96/lupira-domain-events/itemLabels';
import { Sheet } from '@danbro96/lupira-expo-paper/components/Sheet';
import { toast, toastError } from '@danbro96/lupira-expo-feedback/toast';
import { linkPhotosToEvent, unlinkPhotosFromEvent, useLinkCandidates, usePhotoEventLinks } from '../../state/usePhotoEventLinks';
import { useColors } from '../theme';
import { ICONS } from '../icons';

/** One picker for linking a single photo or a selection, in the shared bottom sheet. */
export function LinkEventSheet({ photos, onDismiss, onLinked }: {
  photos: readonly { id: string; takenAt: string }[];
  onDismiss: () => void;
  onLinked?: () => void;
}) {
  const c = useColors();
  const links = usePhotoEventLinks();
  const { data: candidates, isLoading } = useLinkCandidates(photos.map((p) => p.takenAt), true);
  const [busy, setBusy] = useState(false);

  const onPick = async (itemId: string) => {
    setBusy(true);
    const { linked, ok } = await linkPhotosToEvent(itemId, photos.map((p) => p.id), links);
    setBusy(false);
    if (!ok) {
      toastError('Could not link the photos.');
    } else {
      toast(linkedMessage(photos.length, linked.length), linked.length > 0
        ? { action: { label: 'Undo', onPress: () => void unlinkPhotosFromEvent(itemId, linked) } }
        : undefined);
      onLinked?.();
    }
    onDismiss();
  };

  return (
    <Sheet title={linkPhotosTitle(photos.length)} onDismiss={busy ? noop : onDismiss}>
          <ScrollView>
            {isLoading && <Text style={[styles.muted, { color: c.textMuted }]}>Looking…</Text>}
            {!isLoading && (candidates ?? []).length === 0 && (
              <Text style={[styles.muted, { color: c.textMuted }]}>{PHOTO_TEXT.noEventsAround}</Text>
            )}
            {(candidates ?? []).map((item) => (
              <List.Item
                key={item.id}
                title={displayTitle(item.title)}
                description={fmtWhen(item.start, item.isAllDay)}
                left={(props) => <List.Icon {...props} icon={ICONS.calendar} />}
                disabled={busy}
                onPress={() => void onPick(item.id)}
              />
            ))}
          </ScrollView>
    </Sheet>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  muted: { fontSize: 13, marginVertical: 8 },
});
