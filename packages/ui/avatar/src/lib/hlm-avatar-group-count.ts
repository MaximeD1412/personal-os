import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAvatarGroupCount],hlm-avatar-group-count',
	host: {
		'data-slot': 'avatar-group-count',
	},
})
export class HlmAvatarGroupCount {
	constructor() {
		classes(
			() =>
				'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-bold text-label-regular text-on-surface-variant ring-2 ring-surface group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 group-has-data-[size=sm]/avatar-group:text-label-micro',
		);
	}
}
