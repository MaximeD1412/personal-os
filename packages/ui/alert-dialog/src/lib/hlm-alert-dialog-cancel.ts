import { Directive } from '@angular/core';
import { BrnDialogClose } from '@spartan-ng/brain/dialog';

/** « Annuler », posé sur un `hlmBtn variant="secondary"` : ferme sans rien faire. */
@Directive({
	selector: 'button[hlmAlertDialogCancel]',
	hostDirectives: [BrnDialogClose],
	host: { 'data-slot': 'alert-dialog-cancel' },
})
export class HlmAlertDialogCancel {}
