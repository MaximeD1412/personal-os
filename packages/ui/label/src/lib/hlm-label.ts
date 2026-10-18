import { Directive } from '@angular/core';
import { BrnLabel } from '@spartan-ng/brain/label';
import { classes } from '@personal-os/ui/utils';

/** Le libellé d'un champ, celui du master `FormField` : 12/500 `on-surface-variant`. */
@Directive({
	selector: '[hlmLabel]',
	hostDirectives: [{ directive: BrnLabel, inputs: ['id', 'for'] }],
	host: { 'data-slot': 'label' },
})
export class HlmLabel {
	constructor() {
		classes(
			() =>
				'text-label-regular text-on-surface-variant flex items-center gap-2 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-40 peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
		);
	}
}
