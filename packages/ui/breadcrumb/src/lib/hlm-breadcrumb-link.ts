import { Directive, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmBreadcrumbLink]',
	hostDirectives: [
		{
			directive: RouterLink,
			inputs: [
				'target',
				'queryParams',
				'fragment',
				'queryParamsHandling',
				'state',
				'info',
				'relativeTo',
				'preserveFragment',
				'skipLocationChange',
				'replaceUrl',
				'routerLink: link',
			],
		},
	],
	host: {
		'data-slot': 'breadcrumb-link',
	},
})
export class HlmBreadcrumbLink {
	/** Le chemin du niveau. */
	public readonly link = input<RouterLink['routerLink']>();

	constructor() {
		classes(
			() =>
				'rounded-sm transition-colors outline-none hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary',
		);
	}
}
