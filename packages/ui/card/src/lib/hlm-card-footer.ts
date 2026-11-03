import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/**
 * Le pied de carte : une méta en `outline` et, au bout, un lien `primary`
 * (`<a>` enfant direct, suivi au besoin d'une `ng-icon`).
 */
@Directive({
	selector: '[hlmCardFooter],hlm-card-footer',
	host: { 'data-slot': 'card-footer' },
})
export class HlmCardFooter {
	constructor() {
		classes(
			() =>
				'flex items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-sm text-label-micro tracking-normal text-outline [&>a]:ms-auto [&>a]:inline-flex [&>a]:items-center [&>a]:gap-space-xs [&>a]:font-semibold [&>a]:text-primary [&>a]:hover:underline [&>a>ng-icon]:icon-xs',
		);
	}
}
