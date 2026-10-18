import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAvatarBadge],hlm-avatar-badge',
	host: {
		'data-slot': 'avatar-badge',
	},
})
export class HlmAvatarBadge {
	constructor() {
		classes(() => [
			'absolute end-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full bg-secondary ring-2 ring-surface select-none [&>ng-icon]:hidden',
			'group-data-[size=sm]/avatar:size-2 group-data-[size=lg]/avatar:size-3',
		]);
	}
}
