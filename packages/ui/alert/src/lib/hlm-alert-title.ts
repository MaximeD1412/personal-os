import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** Le titre du `Banner` (15/700), suivi au besoin d'un `hlmBadge`. */
@Directive({
	selector: '[hlmAlertTitle]',
	host: {
		'data-slot': 'alert-title',
	},
})
export class HlmAlertTitle {
	constructor() {
		classes(() => 'flex flex-wrap items-center gap-space-sm text-title-sm font-bold text-on-surface');
	}
}
