import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** La zone de fin d'en-tête (`CardHeader/Trailing`) : badge, lien ou bouton d'icône. */
@Directive({
	selector: '[hlmCardAction]',
	host: { 'data-slot': 'card-action' },
})
export class HlmCardAction {
	constructor() {
		classes(() => 'ms-auto flex shrink-0 items-center gap-space-sm');
	}
}
