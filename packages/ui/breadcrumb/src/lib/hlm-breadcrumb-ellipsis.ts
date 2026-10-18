import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matMoreHorizOutline } from '@ng-icons/material-symbols/outline';
import { classes } from '@personal-os/ui/utils';

@Component({
	selector: 'hlm-breadcrumb-ellipsis',
	imports: [NgIcon],
	providers: [provideIcons({ matMoreHorizOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'breadcrumb-ellipsis',
		role: 'presentation',
	},
	template: `
		<ng-icon name="matMoreHorizOutline" aria-hidden="true" />
		<span class="sr-only">{{ srOnlyText() }}</span>
	`,
})
export class HlmBreadcrumbEllipsis {
	/** Le texte lu par les lecteurs d'écran à la place des niveaux masqués. */
	public readonly srOnlyText = input<string>('Niveaux masqués');

	constructor() {
		classes(() => 'flex size-4 items-center justify-center [&>ng-icon]:icon-xs');
	}
}
