import { Directive, input } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { HlmCardConfig, injectHlmCardConfig } from './hlm-card.token';

/**
 * Le master `Card` : fond `surface-container`, bordure 1 px
 * `surface-container-highest`, rayon 12, padding 16 (12 sous 768 px), sans
 * ombre. `variant="nested"` pour une carte dans une carte.
 */
@Directive({
	selector: '[hlmCard],hlm-card',
	host: {
		'data-slot': 'card',
		'[attr.data-variant]': 'variant()',
	},
})
export class HlmCard {
	private readonly _defaultConfig = injectHlmCardConfig();
	public readonly variant = input<HlmCardConfig['variant']>(this._defaultConfig.variant);

	constructor() {
		classes(
			() =>
				'group/card flex flex-col gap-space-md overflow-hidden rounded-md border border-surface-container-highest bg-surface-container p-gutter-compact text-on-surface md:p-gutter data-[variant=nested]:rounded data-[variant=nested]:bg-surface-container-high',
		);
	}
}
