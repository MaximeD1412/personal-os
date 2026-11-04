import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/**
 * Le master `Breadcrumb` : des niveaux en `label-micro` capitales, `outline`,
 * séparés de 6 px par un chevron de 14.
 */
@Directive({
	selector: '[hlmBreadcrumbList]',
	host: {
		'data-slot': 'breadcrumb-list',
	},
})
export class HlmBreadcrumbList {
	constructor() {
		classes(
			() => 'flex flex-wrap items-center gap-1.5 text-label-micro wrap-break-word text-outline uppercase',
		);
	}
}
