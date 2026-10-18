import { computed, Directive, ElementRef, inject } from '@angular/core';
import { BrnToggleGroupItem } from '@spartan-ng/brain/toggle-group';
import { classes } from '@personal-os/ui/utils';
import { cva } from 'class-variance-authority';
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

@Directive({
	selector: 'button[hlmToggleGroupItem]',
	hostDirectives: [
		{
			directive: BrnToggleGroupItem,
			inputs: ['id', 'value', 'disabled', 'aria-label', 'type'],
		},
	],
	host: {
		'data-slot': 'toggle-group-item',
		'[attr.tabindex]': '_tabindex()',
	},
})
export class HlmToggleGroupItem {
	private readonly _groupe = injectHlmToggleGroup();
	private readonly _brn = inject(BrnToggleGroupItem);

	public readonly element: HTMLElement = inject(ElementRef).nativeElement;

	public readonly actif = computed(() => this._groupe.isSelected(this._brn.value()));

	public readonly desactive = computed(() => this._brn.disabled() || this._groupe.disabled());

	/** Seul le segment actif est dans la tabulation ; tous, tant qu'aucun ne l'est. */
	protected readonly _tabindex = computed(() => (this.actif() || this._groupe.value() == null ? 0 : -1));

	constructor() {
		classes(() => toggleGroupItemVariants({ size: this._groupe.size() }));
	}

	activer(): void {
		if (!this.actif()) this._brn.toggle();
	}
}
