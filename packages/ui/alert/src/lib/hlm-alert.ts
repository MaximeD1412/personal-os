import { computed, Directive, input } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Le master `Banner` de la planche `05 Feedback` : une alerte en page, sur le
 * fond teinté de sa tonalité. Pastille d'icône (`hlm-alert-icon`), titre et
 * badge (`hlmAlertTitle`), message (`hlmAlertDescription`) dans
 * `hlmAlertContent`, puis les actions (`hlmAlertAction`).
 *
 * Une erreur qui empêche d'avancer est un `Banner` `error`, jamais un toast
 * seul (docs/design-system.md, « Composer un écran »).
 */
export const alertVariants = cva(
	'group/alert flex w-full flex-wrap items-center gap-space-md rounded-md p-space-md text-start',
	{
		variants: {
			tone: {
				info: 'bg-primary-10',
				success: 'bg-secondary-10',
				warning: 'bg-tertiary-20',
				error: 'bg-error-20',
			},
		},
		defaultVariants: {
			tone: 'info',
		},
	},
);

export type AlertVariants = VariantProps<typeof alertVariants>;
export type AlertTone = NonNullable<AlertVariants['tone']>;

@Directive({
	selector: 'hlm-alert,[hlmAlert]',
	host: {
		'data-slot': 'alert',
		'[attr.data-tone]': 'tone()',
		// Un avertissement ou une erreur s'annonce aussitôt ; une information ou
		// un succès attend la fin de la lecture en cours.
		'[attr.role]': '_role()',
	},
})
export class HlmAlert {
	public readonly tone = input<AlertTone>('info');

	protected readonly _role = computed(() =>
		this.tone() === 'warning' || this.tone() === 'error' ? 'alert' : 'status',
	);

	constructor() {
		classes(() => alertVariants({ tone: this.tone() }));
	}
}
