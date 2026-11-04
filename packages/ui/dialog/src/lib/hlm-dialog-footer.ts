import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { hlmModalFooterClass } from './hlm-dialog-classes';

@Directive({
	selector: '[hlmDialogFooter],hlm-dialog-footer',
	host: { 'data-slot': 'dialog-footer' },
})
export class HlmDialogFooter {
	constructor() {
		classes(() => hlmModalFooterClass);
	}
}
