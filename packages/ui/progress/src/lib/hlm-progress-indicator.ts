import { Directionality } from '@angular/cdk/bidi';
import { Directive, computed, inject } from '@angular/core';
import { BrnProgressIndicator, injectBrnProgress } from '@spartan-ng/brain/progress';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmProgressIndicator],hlm-progress-indicator',
	hostDirectives: [BrnProgressIndicator],
	host: {
		'data-slot': 'progress-indicator',
		'[class.animate-indeterminate]': '_indeterminate()',
		'[style.transform]': '_transform()',
	},
})
export class HlmProgressIndicator {
	private readonly _progress = injectBrnProgress();
	private readonly _dir = inject(Directionality);
	// Offset the indicator by the unfilled remainder. In RTL the bar fills from the inline-start
	// (visually the right), so translate the opposite way to keep the fill on the correct side.
	protected readonly _transform = computed(() => {
		// La valeur se lit sur `max`, pas sur 100 : 5 sur 10 remplit la moitié de
		// la piste. Un maximum nul n'a rien à mesurer : la piste reste vide.
		const value = this._progress.value();
		const max = this._progress.max();
		const pourcentage = value === null || value === undefined ? 100 : max > 0 ? (value / max) * 100 : 0;
		const offset = 100 - pourcentage;
		return `translateX(${this._dir.valueSignal() === 'rtl' ? '' : '-'}${offset}%)`;
	});
	protected readonly _indeterminate = computed(
		() => this._progress.value() === null || this._progress.value() === undefined,
	);

	constructor() {
		classes(
			() =>
				'h-full w-full flex-1 rounded-full bg-secondary transition-all group-data-[tone=error]/progress:bg-error group-data-[tone=primary]/progress:bg-primary-container group-data-[tone=tertiary]/progress:bg-tertiary',
		);
	}
}
