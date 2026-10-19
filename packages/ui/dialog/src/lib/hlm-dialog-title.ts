import { Directive } from '@angular/core';
import { BrnDialogTitle } from '@spartan-ng/brain/dialog';
import { classes } from '@personal-os/ui/utils';
import { hlmModalTitleClass } from './hlm-dialog-classes';

@Directive({
	selector: '[hlmDialogTitle]',
	hostDirectives: [BrnDialogTitle],
	host: { 'data-slot': 'dialog-title' },
})
export class HlmDialogTitle {
	constructor() {
		classes(() => hlmModalTitleClass);
	}
}
