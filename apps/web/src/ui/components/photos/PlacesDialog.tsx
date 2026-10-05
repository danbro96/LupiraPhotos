import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useListPhotoPlaces } from '@lupira/photos-api/query/photo';
import { PlaceIcon } from '@danbro96/lupira-web-mui/icons';
import { useDebounced } from '../../../state/useDebounced';
import { Row, RowName } from '../Rows';

const PLACES_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 250;

/** The photo API's place labels with how many photos carry each: the top 50, or what a search finds. */
export function PlacesDialog({ onPick, onClose }: { onPick: (label: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const term = useDebounced(text.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isLoading, error } = useListPhotoPlaces({ q: term || undefined, limit: PLACES_LIMIT });
  const places = data ?? [];

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Places</DialogTitle>
      <DialogContent sx={{ px: 1 }}>
        <TextField
          size="small" label="Search places" value={text} onChange={(e) => setText(e.target.value)} autoFocus fullWidth
          sx={{ px: 1, mt: 1 }}
        />
        {!term && (
          <Typography variant="caption" sx={{ display: 'block', px: 2, pt: 1, color: 'text.subtle' }}>
            Showing the {PLACES_LIMIT} most photographed places — search for others.
          </Typography>
        )}
        {isLoading && <Typography variant="body2" sx={{ p: 2, color: 'text.subtle' }}>Loading…</Typography>}
        {!isLoading && !error && places.length === 0 && (
          <Typography variant="body2" sx={{ p: 2, color: 'text.subtle' }}>
            {term ? `No place matches “${term}”.` : 'No places yet.'}
          </Typography>
        )}
        <List dense>
          {places.map((place) => (
            <Row key={place.label} onClick={() => onPick(place.label)}>
              <PlaceIcon fontSize="small" />
              <RowName>{place.label}</RowName>
              <Typography variant="caption" sx={{ color: 'text.subtle' }}>{place.count}</Typography>
            </Row>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
