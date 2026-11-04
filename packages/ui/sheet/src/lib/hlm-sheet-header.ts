import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmSheetHeader],hlm-sheet-header',
	host: { 'data-slot': 'sheet-header' },
})
export class HlmSheetHeader {
	constructor() {
		classes(() => 'flex flex-col gap-1.5 p-gutter');
	}
}
