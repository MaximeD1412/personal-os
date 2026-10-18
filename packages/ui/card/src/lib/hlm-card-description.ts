import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmCardDescription]',
	host: { 'data-slot': 'card-description' },
})
export class HlmCardDescription {
	constructor() {
		classes(() => 'order-last basis-full text-body-dense text-outline');
	}
}
