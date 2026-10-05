import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { photoCount } from '@lupira/photos-domain/photoFormat';
import { measuredCount, needsOverwriteConfirm, type LocationState } from '@lupira/photos-domain/photoLocation';
import { dedupeTargets, type PlaceTarget } from '@lupira/photos-domain/placeTarget';
import { MIN_PLACE_QUERY } from '@danbro96/lupira-domain-places/placeCandidates';
import { formatCoords } from '@danbro96/lupira-domain-places/places';
import { fmtWhen } from '@danbro96/lupira-domain-core/time';
import { displayTitle } from '@danbro96/lupira-domain-events/itemLabels';
import { SavedPlaceIcon } from '@danbro96/lupira-web-mui/icons';
import { useSnackbar } from '@danbro96/lupira-web-mui/SnackbarHost';
import { overwriteWarning, relocateMessage } from '../../../state/locationCalls';
import { useAddressSearch, useEventPlace, usePlaceSuggestions, useSavedTargets } from '../../../state/useGeoPlaces';
import { usePhotoActions } from '../../../state/usePhotoActions';
import { useLinkCandidates } from '../../../state/usePhotoLibrary';
import { WrapRow } from '../WrapRow';

type EventPick = { placeId: string; title: string };

const GROUP = { saved: 'Saved', suggest: 'Places', address: 'Addresses', event: 'Events' } as const;

/** Where the photos were taken: a saved place, a searched place or address, or the place of an event.
 *  Applying replaces any position the photos have, and Undo puts it back. */
export function SetLocationDialog({ photos, onClose, onApplied }: {
  photos: readonly (LocationState & { takenAt: string })[];
  onClose: () => void;
  onApplied?: () => void;
}) {
  const actions = usePhotoActions();
  const showSnack = useSnackbar();
  const saved = useSavedTargets();

  const [text, setText] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [picked, setPicked] = useState<PlaceTarget | null>(null);
  const [eventPick, setEventPick] = useState<EventPick | null>(null);
  const [pickingEvent, setPickingEvent] = useState(false);
  const [labelEdit, setLabelEdit] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const term = text.trim();
  const suggestions = usePlaceSuggestions(text);
  const addresses = useAddressSearch(addressQuery, addressQuery !== '');
  const candidates = useLinkCandidates(photos.map((p) => p.takenAt), pickingEvent);
  const eventPlace = useEventPlace(eventPick?.placeId ?? null, eventPick?.title);

  const options = dedupeTargets([
    ...saved.targets.map((s) => s.target),
    ...suggestions.targets,
    ...(addressQuery === term ? addresses.targets : []),
  ]).filter((t) => t.source !== 'saved');

  const target = eventPick ? eventPlace.target : picked;
  const label = labelEdit ?? target?.label ?? '';
  const denied = saved.denied || suggestions.denied || addresses.denied || eventPlace.denied;
  const measured = measuredCount(photos);

  const pick = (next: PlaceTarget) => {
    setPicked(next);
    setEventPick(null);
    setLabelEdit(null);
  };

  const pickEvent = (next: EventPick) => {
    setEventPick(next);
    setPicked(null);
    setLabelEdit(null);
  };

  const onUndo = async (previous: LocationState[], applied: string[]) => {
    showSnack('Restoring…', 'info');
    const { failed } = await actions.undoRelocate(previous, applied);
    if (failed > 0) showSnack(`Could not restore ${photoCount(failed)}`);
  };

  const onApply = async () => {
    if (!target || !label.trim()) return;
    setBusy(true);
    const { done, applied, previous } = await actions.relocate(photos, {
      latitude: target.latitude, longitude: target.longitude, label: label.trim(),
    });
    setBusy(false);
    if (done === 0) {
      showSnack('Could not set the location');
      return;
    }
    showSnack(relocateMessage(done, photos.length), 'success', { label: 'Undo', onPress: () => void onUndo(previous, applied) });
    onApplied?.();
    onClose();
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Set location</DialogTitle>
      <DialogContent>
        {denied && (
          <Alert severity="info" sx={{ mb: 2 }}>Sign out and in again to search places</Alert>
        )}

        {saved.targets.length > 0 && (
          <WrapRow>
            {saved.targets.map((s) => (
              <Chip
                key={s.id}
                icon={<SavedPlaceIcon />}
                label={s.name}
                color={!eventPick && picked?.key === s.target.key ? 'primary' : 'default'}
                disabled={!saved.ready || busy}
                onClick={() => pick(s.target)}
              />
            ))}
          </WrapRow>
        )}

        <Autocomplete<PlaceTarget, false, false, false>
          size="small"
          options={options}
          filterOptions={(x) => x}
          groupBy={(o) => GROUP[o.source]}
          loading={suggestions.isLoading || addresses.isLoading}
          value={null}
          inputValue={text}
          onInputChange={(_, v, reason) => { if (reason !== 'reset') setText(v); }}
          onChange={(_, value) => { if (value) { pick(value); setText(''); } }}
          getOptionKey={(o) => o.key}
          getOptionLabel={(o) => o.label}
          noOptionsText={term.length < MIN_PLACE_QUERY ? 'Type a place or an address' : 'No places found'}
          renderOption={({ key, ...props }, o) => (
            <li key={key} {...props}>
              <ListItemText primary={o.label} secondary={o.detail} />
            </li>
          )}
          renderInput={(params) => <TextField {...params} label="Search places" />}
          disabled={busy}
          sx={{ mt: 1 }}
        />
        <WrapRow>
          <Button
            size="small"
            disabled={busy || term.length < MIN_PLACE_QUERY || addressQuery === term}
            onClick={() => setAddressQuery(term)}
          >
            Search addresses
          </Button>
          <Button size="small" disabled={busy} onClick={() => setPickingEvent((v) => !v)}>
            Place of an event…
          </Button>
        </WrapRow>

        {pickingEvent && (
          <List dense sx={{ maxHeight: 220, overflowY: 'auto' }}>
            {candidates.isLoading && <Typography variant="body2" sx={{ px: 2, color: 'text.subtle' }}>Looking…</Typography>}
            {!candidates.isLoading && (candidates.data ?? []).length === 0 && (
              <Typography variant="body2" sx={{ px: 2, color: 'text.subtle' }}>No events around these photos.</Typography>
            )}
            {(candidates.data ?? []).map((item) => (
              <ListItemButton
                key={item.id}
                disabled={!item.placeId || busy}
                selected={eventPick?.placeId === item.placeId}
                onClick={() => pickEvent({ placeId: item.placeId!, title: displayTitle(item.title) })}
              >
                <ListItemText
                  primary={displayTitle(item.title)}
                  secondary={`${fmtWhen(item.start, item.isAllDay)} · ${item.placeId ? item.locationLabel ?? 'Has a place' : 'No place'}`}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {eventPick && !eventPlace.isLoading && !target && (
          <Typography variant="body2" sx={{ color: 'text.subtle', mt: 1 }}>This event's place has no position.</Typography>
        )}

        {target && (
          <>
            <TextField
              size="small"
              label="Label"
              value={label}
              onChange={(e) => setLabelEdit(e.target.value)}
              disabled={busy}
              fullWidth
              sx={{ mt: 2 }}
            />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {photoCount(photos.length)} → {label.trim() || 'no label'} ({formatCoords(target.latitude, target.longitude)})
            </Typography>
          </>
        )}

        {needsOverwriteConfirm(photos) && (
          <Alert severity="warning" sx={{ mt: 2 }}>{overwriteWarning(measured)}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => void onApply()} disabled={busy || !target || !label.trim()}>Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
