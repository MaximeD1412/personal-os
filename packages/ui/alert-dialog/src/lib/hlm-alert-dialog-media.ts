import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAlertDialogMedia],hlm-alert-dialog-media',
	host: { 'data-slot': 'alert-dialog-media' },
})
export class HlmAlertDialogMedia {
	constructor() {
		classes(() => 'flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-container-highest text-on-surface-variant [&_ng-icon]:icon-md');
	}
}
