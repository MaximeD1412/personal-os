import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmCardContent]',
	host: { 'data-slot': 'card-content' },
})
export class HlmCardContent {
	constructor() {
		classes(() => 'flex flex-col gap-space-sm text-body-dense text-on-surface-variant');
	}
}
