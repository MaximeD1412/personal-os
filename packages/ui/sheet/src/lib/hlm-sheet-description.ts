import { Directive } from '@angular/core';
import { BrnSheetDescription } from '@spartan-ng/brain/sheet';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmSheetDescription]',
	hostDirectives: [BrnSheetDescription],
	host: { 'data-slot': 'sheet-description' },
})
export class HlmSheetDescription {
	constructor() {
		classes(() => 'text-body-dense text-outline');
	}
}
