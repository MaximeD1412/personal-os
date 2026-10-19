import type { BooleanInput } from '@angular/cdk/coercion';
import type { ComponentType } from '@angular/cdk/portal';
import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, TemplateRef } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matCloseOutline } from '@ng-icons/material-symbols/outline';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButton } from '@personal-os/ui/button';

import { classes } from '@personal-os/ui/utils';
import { hlmModalContentClass } from './hlm-dialog-classes';
import { HlmDialogClose } from './hlm-dialog-close';

type HlmDialogContentContext = {
	$component?: ComponentType<unknown> | TemplateRef<unknown>;
	$dynamicComponentClass?: string;
	$showCloseButton?: boolean;
};

@Component({
	selector: 'hlm-dialog-content',
	imports: [NgComponentOutlet, NgTemplateOutlet, HlmButton, HlmDialogClose, NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'dialog-content',
		'[attr.data-state]': 'state()',
	},
	template: `
		@if (_modele) {
			<ng-container [ngTemplateOutlet]="_modele" [ngTemplateOutletContext]="{ $implicit: _dialogRef }" />
		} @else if (_composant) {
			<ng-container [ngComponentOutlet]="_composant" />
		} @else {
			<ng-content />
		}

		@if (showCloseButton()) {
			<button hlmBtn variant="ghost" size="icon" class="absolute end-3 top-3" hlmDialogClose aria-label="Fermer">
				<ng-icon [svg]="_iconeFermer" aria-hidden="true" />
			</button>
		}
	`,
})
export class HlmDialogContent {
	protected readonly _dialogRef = inject(BrnDialogRef);
	private readonly _dialogContext = injectBrnDialogContext<HlmDialogContentContext | null>({ optional: true });

	public readonly showCloseButton = input<boolean, BooleanInput>(this._dialogContext?.$showCloseButton ?? true, {
		transform: booleanAttribute,
	});

	public readonly state = computed(() => this._dialogRef?.state() ?? 'closed');

	public readonly component = this._dialogContext?.$component;
	// `HlmDialogService.open()` reçoit un composant ou un modèle : le modèle se
	// rend par `ngTemplateOutlet`, avec la référence du dialogue en `$implicit`
	// (`<ng-template let-ref>`… `ref.close()`).
	protected readonly _modele = this.component instanceof TemplateRef ? this.component : null;
	protected readonly _composant = this.component instanceof TemplateRef ? null : this.component;
	// L'icône passe en SVG : fournie par `provideIcons` ici, elle serait cherchée
	// depuis le `hlmBtn` qui la projette, qui fournit ses propres icônes.
	protected readonly _iconeFermer = matCloseOutline;
	private readonly _dynamicComponentClass = this._dialogContext?.$dynamicComponentClass;

	constructor() {
		classes(() => [hlmModalContentClass, this._dynamicComponentClass]);
	}
}
