import { computed, Directive, inject, input } from '@angular/core';
import { BrnFieldControl, BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
import { BrnInput } from '@spartan-ng/brain/input';
import { classes } from '@personal-os/ui/utils';
import { inputBoxClasses, type InputSize, inputSizeClasses } from './hlm-input-box';
import { HlmInputGroup } from './hlm-input-group';

/**
 * Le champ du master `Input`. Seul, il porte la boîte ; dans un
 * `hlmInputGroup` (icônes, raccourci), c'est le groupe qui la porte.
 */
@Directive({
	selector: '[hlmInput]',
	hostDirectives: [{ directive: BrnInput, inputs: ['id', 'forceInvalid'] }, BrnFieldControlDescribedBy],
	host: {
		'data-slot': 'input',
		// `forceInvalid` (le refus de l'API sur ce champ) l'annonce aussi : spartan
		// ne pose `aria-invalid` que d'après l'état du contrôle de formulaire.
		'[attr.aria-invalid]': '_invalide() ? "true" : null',
	},
})
export class HlmInput {
	private readonly _groupe = inject(HlmInputGroup, { optional: true });
	private readonly _brnInput = inject(BrnInput);
	private readonly _controle = inject(BrnFieldControl, { optional: true });

	protected readonly _invalide = computed(() => this._brnInput.forceInvalid() || !!this._controle?.invalid());

	public readonly size = input<InputSize>('md');

	constructor() {
		classes(() => [
			'placeholder:text-outline w-full min-w-0',
			this._groupe
				? 'text-body-default text-on-surface h-full flex-1 bg-transparent outline-none disabled:cursor-not-allowed'
				: [inputBoxClasses, 'px-3', inputSizeClasses[this.size()]],
		]);
	}
}
