import { Directive, effect, EffectRef, inject, input, OnDestroy } from '@angular/core';
import { BrnFieldA11yService } from '@spartan-ng/brain/field';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmFieldDescription],hlm-field-description',
	host: {
		'data-slot': 'field-description',
		'[attr.id]': 'id()',
	},
})
export class HlmFieldDescription implements OnDestroy {
	private static _id = 0;

	private readonly _a11y = inject(BrnFieldA11yService, { optional: true, host: true });

	public readonly id = input<string>(`hlm-field-description-${HlmFieldDescription._id++}`);

	private _registeredId?: string;

	private readonly _cleanup: EffectRef | null = this._a11y
		? effect(() => {
				const a11y = this._a11y;
				if (!a11y) return;

				const id = this.id();
				if (this._registeredId && this._registeredId !== id) {
					a11y.unregisterDescription(this._registeredId);
				}

				if (this._registeredId !== id) {
					a11y.registerDescription(id);
					this._registeredId = id;
				}
			})
		: null;

	constructor() {
		// L'aide cède la place à l'erreur quand le champ est en erreur.
		classes(
			() =>
				'text-label-micro text-outline text-start tracking-normal group-data-[matches-spartan-invalid=true]/field:hidden [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary',
		);
	}

	ngOnDestroy() {
		this._cleanup?.destroy();

		if (this._registeredId) {
			this._a11y?.unregisterDescription(this._registeredId);
		}
	}
}
