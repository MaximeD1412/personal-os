import { Directive } from '@angular/core';
import { BrnSelectPlaceholder } from '@spartan-ng/brain/select';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmSelectPlaceholder],hlm-select-placeholder',
	hostDirectives: [BrnSelectPlaceholder],
	host: { 'data-slot': 'select-placeholder' },
})
export class HlmSelectPlaceholder {
	constructor() {
		classes(
			() =>
				"[&_ng-icon]:icon-xs flex gap-2 items-center data-hidden:hidden [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0",
		);
	}
}
