import { Directive, inject, input } from '@angular/core';
import { BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
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
	host: { 'data-slot': 'input' },
})
export class HlmInput {
	private readonly _groupe = inject(HlmInputGroup, { optional: true });

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
