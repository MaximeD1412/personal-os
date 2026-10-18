import { Directive, input } from '@angular/core';
import { BrnProgress } from '@spartan-ng/brain/progress';
import { classes } from '@personal-os/ui/utils';

/** La couleur du remplissage : `secondary` (défaut du master), `primary`, `tertiary`, `error`. */
export type HlmProgressTone = 'primary' | 'secondary' | 'tertiary' | 'error';
export type HlmProgressThickness = 4 | 6;

/**
 * Le master `ProgressBar` : une piste `surface-container-highest` de 4 ou
 * 6 px, en capsule. Donne-lui un nom (`aria-label`) : c'est une barre de
 * progression pour les lecteurs d'écran.
 */
@Directive({
	selector: 'hlm-progress,[hlmProgress]',
	hostDirectives: [{ directive: BrnProgress, inputs: ['value', 'max', 'getValueLabel'] }],
	host: {
		'data-slot': 'progress',
		'[attr.data-tone]': 'tone()',
		'[attr.data-thickness]': 'thickness()',
	},
})
export class HlmProgress {
	public readonly tone = input<HlmProgressTone>('secondary');
	public readonly thickness = input<HlmProgressThickness, HlmProgressThickness | `${HlmProgressThickness}`>(4, {
		transform: (valeur) => Number(valeur) as HlmProgressThickness,
	});

	constructor() {
		classes(
			() =>
				'group/progress relative inline-flex h-1 w-full overflow-hidden rounded-full bg-surface-container-highest data-[thickness=6]:h-1.5',
		);
	}
}
