import { contentChildren, Directive, forwardRef, input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { BrnToggleGroup, provideBrnToggleGroup } from '@spartan-ng/brain/toggle-group';
import { classes } from '@personal-os/ui/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { HlmToggleGroupItem } from './hlm-toggle-group-item';
import { provideHlmToggleGroup } from './hlm-toggle-group.token';

/**
 * Le master `SegmentedControl` : `sm` est le master (libellés 11 px), `md` sa
 * variante de la galerie (12 px, fond `surface-container-low`, rayon 12).
 */
export const toggleGroupVariants = cva('bg-surface-container-lowest inline-flex w-fit items-center gap-0.5 p-1', {
	variants: {
		size: {
			sm: 'rounded',
			md: 'bg-surface-container-low rounded-md',
		},
	},
	defaultVariants: { size: 'sm' },
});

export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>;

const PAS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Le SegmentedControl : un choix unique parmi des segments (`Tab/Active`,
 * `Tab/Inactive`). Toujours un segment actif : un clic sur l'actif ne le
 * désactive pas. Au clavier, seul le segment actif est dans la tabulation ;
 * les flèches, Début et Fin changent de segment.
 */
@Directive({
	selector: '[hlmToggleGroup],hlm-toggle-group',
	exportAs: 'hlmToggleGroup',
	providers: [
		provideBrnToggleGroup(HlmToggleGroup),
		provideHlmToggleGroup(HlmToggleGroup),
		{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HlmToggleGroup), multi: true },
	],
	host: {
		'data-slot': 'toggle-group',
		'[attr.data-size]': 'size()',
		'(keydown)': '_naviguer($event)',
	},
})
export class HlmToggleGroup<T = unknown> extends BrnToggleGroup<T> {
	public readonly size = input<ToggleGroupVariants['size']>('sm');

	private readonly _segments = contentChildren(HlmToggleGroupItem, { descendants: true });

	constructor() {
		super();
		classes(() => toggleGroupVariants({ size: this.size() }));
	}

	/** Un choix unique : le segment actif ne se désélectionne pas. */
	override canDeselect(): boolean {
		return false;
	}

	protected _naviguer(event: KeyboardEvent): void {
		const segments = this._segments().filter((segment) => !segment.desactive());
		const courant = segments.findIndex((segment) => segment.element.contains(event.target as Node));
		const pas = PAS[event.key];
		let cible: HlmToggleGroupItem | undefined;
		if (event.key === 'Home') cible = segments[0];
		else if (event.key === 'End') cible = segments.at(-1);
		else if (pas && courant >= 0) cible = segments[(courant + pas + segments.length) % segments.length];
		if (!cible) return;

		event.preventDefault();
		cible.activer();
		cible.element.focus();
	}
}
