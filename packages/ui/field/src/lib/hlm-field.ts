import { Directive, input } from '@angular/core';
import { BrnField } from '@spartan-ng/brain/field';
import { classes } from '@personal-os/ui/utils';
import { cva, VariantProps } from 'class-variance-authority';

/**
 * Le master `FormField` : libellé, champ, aide ou erreur, empilés à 6 px.
 * `horizontal` aligne une case ou un switch avec son libellé.
 */
const fieldVariants = cva('group/field flex w-full', {
	variants: {
		orientation: {
			vertical: 'flex-col gap-1.5 *:w-full [&>.sr-only]:w-auto',
			horizontal: 'flex-row items-center gap-2',
		},
	},
	defaultVariants: {
		orientation: 'vertical',
	},
});

export type FieldVariants = VariantProps<typeof fieldVariants>;

@Directive({
	selector: '[hlmField],hlm-field',
	hostDirectives: [{ directive: BrnField, inputs: ['data-invalid', 'forceInvalid'] }],
	host: {
		role: 'group',
		'data-slot': 'field',
		'[attr.data-orientation]': 'orientation()',
	},
})
export class HlmField {
	public readonly orientation = input<FieldVariants['orientation']>('vertical');

	constructor() {
		classes(() => fieldVariants({ orientation: this.orientation() }));
	}
}
