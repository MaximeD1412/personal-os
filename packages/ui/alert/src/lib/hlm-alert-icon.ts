import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
	matCheckCircleOutline,
	matErrorOutline,
	matInfoOutline,
	matNotificationImportantOutline,
} from '@ng-icons/material-symbols/outline';
import { classes } from '@personal-os/ui/utils';
import { HlmAlert, type AlertTone } from './hlm-alert';

const icones: Record<AlertTone, string> = {
	info: matInfoOutline,
	success: matCheckCircleOutline,
	warning: matNotificationImportantOutline,
	error: matErrorOutline,
};

const teintes: Record<AlertTone, string> = {
	info: 'bg-primary-20 text-primary',
	success: 'bg-secondary-15 text-secondary',
	warning: 'bg-tertiary-fill-20 text-tertiary',
	error: 'bg-error-30 text-error',
};

/**
 * La pastille d'icône du `Banner` : 40 × 40, icône 24 dans la couleur de la
 * tonalité. L'icône par défaut suit la tonalité ; `icon` la remplace (un SVG
 * de `@ng-icons/material-symbols/outline`, par exemple `matPlaylistAddOutline`).
 */
@Component({
	selector: 'hlm-alert-icon',
	imports: [NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { 'data-slot': 'alert-icon', 'aria-hidden': 'true' },
	template: `<ng-icon [svg]="_svg()" class="icon-lg" />`,
})
export class HlmAlertIcon {
	private readonly _alert = inject(HlmAlert, { optional: true });

	/** Le SVG de l'icône ; par défaut, celui de la tonalité. */
	public readonly icon = input<string>();

	private readonly _tone = computed(() => this._alert?.tone() ?? 'info');
	protected readonly _svg = computed(() => this.icon() ?? icones[this._tone()]);

	constructor() {
		classes(() => ['flex size-10 shrink-0 items-center justify-center rounded-md', teintes[this._tone()]]);
	}
}
