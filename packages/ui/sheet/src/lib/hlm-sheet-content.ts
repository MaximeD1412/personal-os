import type { BooleanInput } from '@angular/cdk/coercion';
import {
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	effect,
	ElementRef,
	inject,
	input,
	Renderer2,
	signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matCloseOutline } from '@ng-icons/material-symbols/outline';
import { injectExposedSideProvider, injectExposesStateProvider } from '@spartan-ng/brain/core';
import { HlmButton } from '@personal-os/ui/button';

import { classes } from '@personal-os/ui/utils';
import { HlmSheetClose } from './hlm-sheet-close';

/**
 * Un panneau latéral (le « Plus » de la barre d'onglets mobile) : fond
 * `surface-container-lowest`, bordure `surface-container-highest`, l'ombre
 * des popovers. Le dialogue de CDK piège le focus et le ferme par Échap.
 */
@Component({
	selector: 'hlm-sheet-content',
	imports: [HlmButton, HlmSheetClose, NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'sheet-content',
		'[attr.data-side]': '_sideProvider.side()',
		'[attr.data-state]': 'state()',
	},
	template: `
		<ng-content />

		@if (showCloseButton()) {
			<button hlmBtn variant="ghost" size="icon" class="absolute end-3 top-3" hlmSheetClose>
				<span class="sr-only">Fermer</span>
				<ng-icon [svg]="_iconeFermer" aria-hidden="true" />
			</button>
		}
	`,
})
export class HlmSheetContent {
	private readonly _stateProvider = injectExposesStateProvider({ host: true });
	protected readonly _sideProvider = injectExposedSideProvider({ host: true });
	public readonly state = this._stateProvider.state ?? signal('closed');
	// L'icône passe en SVG : fournie par `provideIcons` ici, elle serait cherchée
	// depuis le `hlmBtn` qui la projette, qui fournit ses propres icônes.
	protected readonly _iconeFermer = matCloseOutline;
	private readonly _renderer = inject(Renderer2);
	private readonly _element = inject(ElementRef);

	public readonly showCloseButton = input<boolean, BooleanInput>(true, { transform: booleanAttribute });

	constructor() {
		classes(() => [
			'fixed flex flex-col gap-space-md border-surface-container-highest bg-surface-container-lowest bg-clip-padding text-body-dense text-on-surface shadow-popover transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm',
			'data-open:animate-in data-closed:animate-out',
			'data-[side=top]:data-closed:slide-out-to-top data-[side=top]:data-open:slide-in-from-top',
			'data-[side=bottom]:data-closed:slide-out-to-bottom data-[side=bottom]:data-open:slide-in-from-bottom',
			'data-[side=left]:data-closed:slide-out-to-left data-[side=left]:data-open:slide-in-from-left',
			'data-[side=right]:data-closed:slide-out-to-right data-[side=right]:data-open:slide-in-from-right',
		]);
		effect(() => {
			this._renderer.setAttribute(this._element.nativeElement, 'data-state', this.state());
		});
	}
}
