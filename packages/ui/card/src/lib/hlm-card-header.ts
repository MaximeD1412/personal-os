import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/**
 * Le master `CardHeader` : le titre à gauche, la zone de fin (`hlmCardAction`)
 * à droite ; une description (`hlmCardDescription`) passe à la ligne dessous.
 */
@Directive({
	selector: '[hlmCardHeader],hlm-card-header',
	host: { 'data-slot': 'card-header' },
})
export class HlmCardHeader {
	constructor() {
		classes(() => 'flex flex-wrap items-center justify-between gap-x-space-sm gap-y-0.5');
	}
}
