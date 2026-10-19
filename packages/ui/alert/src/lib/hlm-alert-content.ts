import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** Le bloc de textes du `Banner` : titre puis message, à 2 px. */
@Directive({
	selector: '[hlmAlertContent],hlm-alert-content',
	host: { 'data-slot': 'alert-content' },
})
export class HlmAlertContent {
	constructor() {
		classes(() => 'flex min-w-0 flex-1 basis-60 flex-col gap-0.5');
	}
}
