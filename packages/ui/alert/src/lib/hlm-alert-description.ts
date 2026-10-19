import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** Le message du `Banner`, en `body-dense` `on-surface-variant`. */
@Directive({
	selector: '[hlmAlertDescription]',
	host: {
		'data-slot': 'alert-description',
	},
})
export class HlmAlertDescription {
	constructor() {
		classes(() => 'text-body-dense text-on-surface-variant [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-3');
	}
}
