import type { BooleanInput } from '@angular/cdk/coercion';
import { booleanAttribute, computed, Directive, ElementRef, inject, input } from '@angular/core';
import type { BrnToggleGroupItem } from '@spartan-ng/brain/toggle-group';
import { classes } from '@personal-os/ui/utils';
import { cva } from 'class-variance-authority';
import type { HlmToggleGroup } from './hlm-toggle-group';
import { injectHlmToggleGroup } from './hlm-toggle-group.token';

/** Les masters `Tab/Active` (`data-state="on"`) et `Tab/Inactive`. */
export const toggleGroupItemVariants = cva(
	[
		'text-on-surface-variant inline-flex cursor-pointer items-center justify-center gap-1.5 rounded px-2 py-1 font-medium whitespace-nowrap outline-none select-none',
		'transition-[color,background-color,box-shadow,scale,opacity]',
		'data-[state=on]:bg-primary-20 data-[state=on]:text-primary data-[state=on]:font-semibold hover:not-disabled:data-[state=off]:bg-surface-container',
		'focus-visible:ring-primary-20 focus-visible:outline-primary focus-visible:ring-2 focus-visible:outline-1 focus-visible:outline-solid focus-visible:-outline-offset-1',
		'active:not-disabled:scale-98 disabled:cursor-not-allowed disabled:opacity-40',
		'[&_ng-icon]:icon-2xs [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0',
	],
	{
		variants: {
			size: {
				sm: 'text-label-micro tracking-normal',
				md: 'text-label-regular',
			},
		},
		defaultVariants: { size: 'sm' },
	},
);

/**
 * Un segment. Il ne passe pas par `BrnToggleGroupItem`, qui ne lit que
 * l'entrée `disabled` du groupe : un groupe désactivé par son `FormControl`
 * (`disabledState`) y resterait cliquable et dans la tabulation.
 */
@Directive({
	selector: 'button[hlmToggleGroupItem]',
	host: {
		'data-slot': 'toggle-group-item',
		type: 'button',
		'[attr.disabled]': 'desactive() ? true : null',
		'[attr.data-disabled]': 'desactive() ? true : null',
		'[attr.data-state]': 'actif() ? "on" : "off"',
		'[attr.aria-pressed]': 'actif()',
		'[attr.tabindex]': '_tabindex()',
		'(click)': 'activer()',
	},
})
export class HlmToggleGroupItem<T = unknown> {
	private readonly _groupe = injectHlmToggleGroup() as HlmToggleGroup<T>;

	public readonly element: HTMLElement = inject(ElementRef).nativeElement;

	public readonly value = input<T>();

	public readonly disabled = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	public readonly actif = computed(() => this._groupe.isSelected(this.value() as T));

	public readonly desactive = computed(() => this.disabled() || this._groupe.disabledState());

	/** Un seul segment dans la tabulation, choisi par le groupe. */
	protected readonly _tabindex = computed(() => (this._groupe.segmentTabulable() === this ? 0 : -1));

	constructor() {
		classes(() => toggleGroupItemVariants({ size: this._groupe.size() }));
	}

	activer(): void {
		if (this.desactive() || this.actif()) return;
		this._groupe.select(this.value() as T, this as unknown as BrnToggleGroupItem<T>);
	}
}
