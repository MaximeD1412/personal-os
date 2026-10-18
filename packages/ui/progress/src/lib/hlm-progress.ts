import { computed, Directive, inject, input } from '@angular/core';
import { BrnProgress } from '@spartan-ng/brain/progress';
import { classes } from '@personal-os/ui/utils';

/** La couleur du remplissage : `secondary` (défaut du master), `primary`, `tertiary`, `error`. */
export type HlmProgressTone = 'primary' | 'secondary' | 'tertiary' | 'error';
export type HlmProgressThickness = 4 | 6;

/**
 * Le libellé par défaut, en pourcentage du maximum. Celui de spartan divise
 * sans garde et annonce « NaN% » pour un maximum nul ; ici, la piste vide se
 * lit « 0% ».
 */
export function libelleDeProgression(value: number, max: number): string {
	return `${max > 0 ? Math.round((value / max) * 100) : 0}%`;
}

/**
 * Le master `ProgressBar` : une piste `surface-container-highest` de 4 ou
 * 6 px, en capsule. Donne-lui un nom (`aria-label`) : c'est une barre de
 * progression pour les lecteurs d'écran.
 */
@Directive({
	selector: 'hlm-progress,[hlmProgress]',
	hostDirectives: [{ directive: BrnProgress, inputs: ['value', 'max'] }],
	host: {
		'data-slot': 'progress',
		// Remplace le libellé posé par BrnProgress : les liaisons de l'hôte
		// passent après celles de ses directives.
		'[attr.aria-valuetext]': '_libelle()',
		'[attr.data-tone]': 'tone()',
		'[attr.data-thickness]': 'thickness()',
	},
})
export class HlmProgress {
	private readonly _brn = inject(BrnProgress);

	/** Le texte que lisent les technologies d'assistance (`aria-valuetext`). */
	public readonly getValueLabel = input<(value: number, max: number) => string>(libelleDeProgression);
	public readonly tone = input<HlmProgressTone>('secondary');

	protected readonly _libelle = computed(() => {
		const value = this._brn.value();
		return value === null || value === undefined ? null : this.getValueLabel()(value, this._brn.max());
	});
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
