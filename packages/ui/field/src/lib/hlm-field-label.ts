import { Directive } from '@angular/core';
import { HlmLabel } from '@personal-os/ui/label';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmFieldLabel],hlm-field-label',
	hostDirectives: [HlmLabel],
	host: { 'data-slot': 'field-label' },
})
export class HlmFieldLabel {
	constructor() {
		classes(() => 'w-fit group-data-[disabled=true]/field:opacity-40');
	}
}
