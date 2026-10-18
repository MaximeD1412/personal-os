import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: 'brn-switch-thumb[hlm],[hlmSwitchThumb]',
	host: { 'data-slot': 'switch-thumb' },
})
export class HlmSwitchThumb {
	constructor() {
		classes(
			() =>
				'pointer-events-none block size-4 rounded-full ring-0 transition-transform data-checked:bg-on-primary data-unchecked:bg-outline data-unchecked:translate-x-0 data-checked:ltr:translate-x-4 data-checked:rtl:-translate-x-4',
		);
	}
}
