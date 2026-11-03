import { Directive } from '@angular/core';
import { BrnAlertDialogTitle } from '@spartan-ng/brain/alert-dialog';
import { hlmModalTitleClass } from '@personal-os/ui/dialog';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAlertDialogTitle]',
	hostDirectives: [BrnAlertDialogTitle],
	host: { 'data-slot': 'alert-dialog-title' },
})
export class HlmAlertDialogTitle {
	constructor() {
		classes(() => hlmModalTitleClass);
	}
}
