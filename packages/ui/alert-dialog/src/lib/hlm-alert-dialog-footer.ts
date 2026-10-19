import { Directive } from '@angular/core';
import { hlmModalFooterClass } from '@personal-os/ui/dialog';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAlertDialogFooter],hlm-alert-dialog-footer',
	host: { 'data-slot': 'alert-dialog-footer' },
})
export class HlmAlertDialogFooter {
	constructor() {
		classes(() => hlmModalFooterClass);
	}
}
