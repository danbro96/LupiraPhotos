import { outcomeMessage } from '@lupira/photos-domain/photoFormat';
import type { Outcome } from './usePhotoActions';

/** Runs an Undo offered on a snackbar; a rejection or any photo it could not put back is reported. */
export function undo(work: Promise<Outcome>, notify: (message: string) => void): void {
  work.then(
    (outcome) => { if (outcome.failed > 0) notify(outcome.done > 0 ? outcomeMessage('Undid', outcome) : 'Could not undo'); },
    () => notify('Could not undo'),
  );
}
