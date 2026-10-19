import type { BooleanInput } from '@angular/cdk/coercion';
import type { ComponentType } from '@angular/cdk/portal';
import { NgComponentOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import { matCloseOutline } from '@ng-icons/material-symbols/outline';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButton } from '@personal-os/ui/button';

import { classes } from '@personal-os/ui/utils';
import { hlmModalContentClass } from './hlm-dialog-classes';
import { HlmDialogClose } from './hlm-dialog-close';

type HlmDialogContentContext = {
	$component?: ComponentType<unknown>;
	$dynamicComponentClass?: string;
	$showCloseButton?: boolean;
};

@Component({
	selector: 'hlm-dialog-content',
	imports: [NgComponentOutlet, HlmButton, HlmDialogClose, NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'dialog-content',
		'[attr.data-state]': 'state()',
	},
	template: `
		@if (component) {
			<ng-container [ngComponentOutlet]="component" />
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
	private readonly _dialogRef = inject(BrnDialogRef);
	private readonly _dialogContext = injectBrnDialogContext<HlmDialogContentContext | null>({ optional: true });

	public readonly showCloseButton = input<boolean, BooleanInput>(this._dialogContext?.$showCloseButton ?? true, {
		transform: booleanAttribute,
	});

	public readonly state = computed(() => this._dialogRef?.state() ?? 'closed');

	public readonly component = this._dialogContext?.$component;
	// L'icône passe en SVG : fournie par `provideIcons` ici, elle serait cherchée
	// depuis le `hlmBtn` qui la projette, qui fournit ses propres icônes.
	protected readonly _iconeFermer = matCloseOutline;
	private readonly _dynamicComponentClass = this._dialogContext?.$dynamicComponentClass;

	constructor() {
		classes(() => [hlmModalContentClass, this._dynamicComponentClass]);
	}
}
