import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matChevronRightOutline } from '@ng-icons/material-symbols/outline';
import { classes } from '@personal-os/ui/utils';

/** Le master `Breadcrumb/Separator` : `chevron_right` 14, `outline`. */
@Component({
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: '[hlmBreadcrumbSeparator]',
	imports: [NgIcon],
	providers: [provideIcons({ matChevronRightOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'breadcrumb-separator',
		role: 'presentation',
		'aria-hidden': 'true',
	},
	template: `
		<ng-content>
			<ng-icon name="matChevronRightOutline" />
		</ng-content>
	`,
})
export class HlmBreadcrumbSeparator {
	constructor() {
		classes(() => 'flex text-outline [&>ng-icon]:icon-2xs');
	}
}
