import { Directive } from '@angular/core';
import { BrnSheetTitle } from '@spartan-ng/brain/sheet';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmSheetTitle]',
	hostDirectives: [BrnSheetTitle],
	host: { 'data-slot': 'sheet-title' },
})
export class HlmSheetTitle {
	constructor() {
		classes(() => 'text-headline-md text-on-surface');
	}
}
