import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { hlmModalBodyClass } from './hlm-dialog-classes';

/** Le contenu projeté de la modale : formulaire, résumé, options. */
@Directive({
	selector: '[hlmDialogBody],hlm-dialog-body',
	host: { 'data-slot': 'dialog-body' },
})
export class HlmDialogBody {
	constructor() {
		classes(() => hlmModalBodyClass);
	}
}
