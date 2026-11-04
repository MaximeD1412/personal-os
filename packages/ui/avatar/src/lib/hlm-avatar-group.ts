import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAvatarGroup],hlm-avatar-group',
	host: {
		'data-slot': 'avatar-group',
	},
})
export class HlmAvatarGroup {
	constructor() {
		classes(() => 'group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-surface');
	}
}
