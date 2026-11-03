import { Directive, effect, inject } from '@angular/core';
import { HlmButton } from '@personal-os/ui/button';
import { classes } from '@personal-os/ui/utils';
import { HlmAlert, type AlertTone } from './hlm-alert';

/**
 * Les actions du `Banner`, à droite : une secondaire (`hlmBtn
 * variant="secondary" size="sm"`), puis la principale (`hlmAlertPrimaryAction`).
 */
@Directive({
	selector: '[hlmAlertAction],hlm-alert-action',
	host: {
		'data-slot': 'alert-action',
	},
})
export class HlmAlertAction {
	constructor() {
		classes(() => 'flex shrink-0 flex-wrap items-center gap-space-sm');
	}
}

const principales: Record<AlertTone, string> = {
	info: '',
	success:
		'bg-secondary-container text-on-secondary-container hover:not-data-[disabled]:bg-secondary',
	warning: 'bg-tertiary text-on-tertiary hover:not-data-[disabled]:bg-tertiary-fixed',
	error:
		'bg-error-container text-on-error-container hover:not-data-[disabled]:bg-error hover:not-data-[disabled]:text-on-error',
};

/**
 * L'action principale du `Banner`, posée sur un `hlmBtn size="sm"` : elle
 * prend la couleur de la tonalité (le primaire du bouton pour `info`).
 */
@Directive({
	selector: 'button[hlmAlertPrimaryAction],a[hlmAlertPrimaryAction]',
	host: { 'data-slot': 'alert-primary-action' },
})
export class HlmAlertPrimaryAction {
	constructor() {
		const bouton = inject(HlmButton);
		const alerte = inject(HlmAlert, { optional: true });
		effect(() => bouton.setClass(principales[alerte?.tone() ?? 'info']));
	}
}
