import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { hlmModalHeaderClass } from './hlm-dialog-classes';

@Directive({
	selector: '[hlmDialogHeader],hlm-dialog-header',
	host: { 'data-slot': 'dialog-header' },
})
export class HlmDialogHeader {
	constructor() {
		// Le bouton de fermeture est posé en haut à droite : le titre lui laisse la place.
		classes(() => [hlmModalHeaderClass, 'pe-14']);
	}
}
