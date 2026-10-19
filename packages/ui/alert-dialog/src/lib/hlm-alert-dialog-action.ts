import { Directive } from '@angular/core';

/**
 * L'action principale d'une confirmation, posée sur un `hlmBtn` : nommée par
 * le verbe (« Clôturer la liste »), `variant="destructive"` pour une
 * suppression.
 */
@Directive({
	selector: 'button[hlmAlertDialogAction]',
	host: { 'data-slot': 'alert-dialog-action' },
})
export class HlmAlertDialogAction {}
