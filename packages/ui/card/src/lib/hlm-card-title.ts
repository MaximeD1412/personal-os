import { Directive, input } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/**
 * La couleur de l'icône de pilier : Agenda et Projets en `primary`, Sport et
 * Finances en `secondary`, Repas, Stock et Courses en `tertiary`,
 * Infrastructure en `outline`.
 */
export type HlmCardTitleTone = 'primary' | 'secondary' | 'tertiary' | 'outline';

/** Le master `CardTitle` : une `ng-icon` de pilier (20 px) puis le titre en `title-sm`. */
@Directive({
	selector: '[hlmCardTitle]',
	host: {
		'data-slot': 'card-title',
		'[attr.data-tone]': 'tone()',
	},
})
export class HlmCardTitle {
	public readonly tone = input<HlmCardTitleTone>('primary');

	constructor() {
		classes(
			() =>
				'flex min-w-0 items-center gap-space-sm text-title-sm text-on-surface [&>ng-icon]:icon-md [&>ng-icon]:shrink-0 [&>ng-icon]:text-primary data-[tone=outline]:[&>ng-icon]:text-outline data-[tone=secondary]:[&>ng-icon]:text-secondary data-[tone=tertiary]:[&>ng-icon]:text-tertiary',
		);
	}
}
