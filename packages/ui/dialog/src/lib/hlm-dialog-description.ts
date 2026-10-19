import { Directive } from '@angular/core';
import { BrnDialogDescription } from '@spartan-ng/brain/dialog';
import { classes } from '@personal-os/ui/utils';
import { hlmModalDescriptionClass } from './hlm-dialog-classes';

@Directive({
	selector: '[hlmDialogDescription]',
	hostDirectives: [BrnDialogDescription],
	host: { 'data-slot': 'dialog-description' },
})
export class HlmDialogDescription {
	constructor() {
		classes(() => hlmModalDescriptionClass);
	}
}
