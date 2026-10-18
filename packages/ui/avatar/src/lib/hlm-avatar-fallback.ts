import { Directive } from '@angular/core';
import { BrnAvatarFallback } from '@spartan-ng/brain/avatar';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAvatarFallback]',
	exportAs: 'hlmAvatarFallback',
	hostDirectives: [BrnAvatarFallback],
	host: {
		'data-slot': 'avatar-fallback',
	},
})
export class HlmAvatarFallback {
	constructor() {
		classes(() => [
			'flex size-full items-center justify-center rounded-full bg-primary font-bold text-label-regular text-on-primary [&>ng-icon]:icon-sm',
			'group-data-[size=sm]/avatar:text-label-micro group-data-[size=sm]/avatar:[&>ng-icon]:icon-xs',
			'group-data-[size=lg]/avatar:text-body-default group-data-[size=lg]/avatar:[&>ng-icon]:icon-md',
			'group-data-[tone=secondary]/avatar:bg-secondary-container group-data-[tone=secondary]/avatar:text-on-secondary-container',
			'group-data-[tone=neutral]/avatar:bg-surface-container-high group-data-[tone=neutral]/avatar:text-on-surface-variant',
		]);
	}
}
