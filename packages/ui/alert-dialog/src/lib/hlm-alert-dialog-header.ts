import { Directive } from '@angular/core';
import { hlmModalHeaderClass } from '@personal-os/ui/dialog';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAlertDialogHeader],hlm-alert-dialog-header',
	host: { 'data-slot': 'alert-dialog-header' },
})
export class HlmAlertDialogHeader {
	constructor() {
		classes(() => hlmModalHeaderClass);
	}
}
