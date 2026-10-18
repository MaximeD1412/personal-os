import { Directive, input } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { type InputSize, inputSizeClasses } from './hlm-input-box';

/**
 * Le master `Input` avec ses parties : une icône de tête (`ng-icon` avant le
 * champ), une icône de fin ou un raccourci (`kbd hlmKbd`) après. La boîte est
 * portée par le groupe, le champ `hlmInput` qu'il contient s'y fond.
 */
@Directive({
	selector: '[hlmInputGroup],hlm-input-group',
	host: { 'data-slot': 'input-group' },
})
export class HlmInputGroup {
	public readonly size = input<InputSize>('md');

	constructor() {
		classes(() => [
			'bg-surface-container-lowest border-surface-container-highest text-body-default text-on-surface flex w-full min-w-0 items-center gap-2 rounded border px-3 transition-[border-color,box-shadow,opacity]',
			'[&:hover:not(:focus-within,:has(:disabled),:has([data-matches-spartan-invalid=true]))]:border-outline-variant',
			'focus-within:ring-primary-20 focus-within:ring-2 focus-within:not-has-[[data-matches-spartan-invalid=true]]:border-primary',
			'has-[[data-matches-spartan-invalid=true]]:border-error',
			'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40',
			'[&>ng-icon]:icon-sm [&>ng-icon]:text-outline [&>ng-icon]:shrink-0',
			inputSizeClasses[this.size()],
		]);
	}
}
