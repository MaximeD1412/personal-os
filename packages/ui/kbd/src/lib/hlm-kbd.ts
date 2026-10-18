import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** Le master `KeyboardHint` : un raccourci clavier (`⌘K`, `Esc`, `↵`). */
@Directive({
	selector: 'kbd[hlmKbd]',
	host: {
		'data-slot': 'kbd',
	},
})
export class HlmKbd {
	constructor() {
		classes(
			() =>
				'bg-surface-container-lowest text-outline text-label-micro pointer-events-none inline-flex w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 py-0.5 font-body tracking-normal select-none [&_ng-icon]:icon-2xs',
		);
	}
}
