import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/** Le niveau courant (`Crumb current`) : `on-surface-variant`, sans lien. */
@Directive({
	selector: '[hlmBreadcrumbPage]',
	host: {
		'data-slot': 'breadcrumb-page',
		role: 'link',
		'aria-disabled': 'true',
		'aria-current': 'page',
	},
})
export class HlmBreadcrumbPage {
	constructor() {
		classes(() => 'text-on-surface-variant');
	}
}
