import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';
import {
	matCheckCircleOutline,
	matCloseOutline,
	matErrorOutline,
	matInfoOutline,
} from '@ng-icons/material-symbols/outline';
import { toast } from '@spartan-ng/brain/sonner';
import { classes } from '@personal-os/ui/utils';

export type ToastTone = 'success' | 'error' | 'neutral';

/** L'action d'un toast : une icône, son libellé lu, et ce qu'elle fait. */
export interface ToastAction {
	/** Le SVG de l'icône (`@ng-icons/material-symbols/outline`). */
	icon: string;
	label: string;
	onClick?: () => void;
}

const fonds: Record<ToastTone, string> = {
	success: 'bg-secondary-container text-on-secondary-container',
	error: 'bg-error-container text-on-error-container',
	neutral: 'border border-outline-variant bg-surface-container-high text-on-surface',
};

const icones: Record<ToastTone, string> = {
	success: matCheckCircleOutline,
	error: matErrorOutline,
	neutral: matInfoOutline,
};

/**
 * Le master `Toast` de la planche `05 Feedback` : 358 de large, icône 20,
 * message 13/500, action en icône 18 à droite. `success` sur
 * `secondary-container`, `error` sur `error-container`, `neutral` sur
 * `surface-container-high` bordé `outline-variant`, icône `primary`.
 *
 * Un toast confirme une action réussie ; une erreur qui empêche d'avancer est
 * un `Banner` ou une erreur de champ, jamais un toast seul. Il s'affiche par
 * `showToast()`, dans le `hlm-toaster` posé une fois par l'application.
 */
@Component({
	selector: 'hlm-toast',
	imports: [NgIcon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { 'data-slot': 'toast', '[attr.data-tone]': 'tone()' },
	template: `
		<div class="flex min-w-0 items-center gap-space-sm">
			<ng-icon [svg]="_icone()" class="icon-md shrink-0" [class.text-primary]="tone() === 'neutral'" aria-hidden="true" />
			<p class="text-body-dense font-medium">{{ message() }}</p>
		</div>
		<button
			type="button"
			class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-current"
			[class.text-outline]="tone() === 'neutral' && !action()"
			[attr.aria-label]="action()?.label ?? 'Fermer'"
			(click)="_agir()"
		>
			<ng-icon [svg]="action()?.icon ?? _iconeFermer" class="icon-sm" aria-hidden="true" />
		</button>
	`,
})
export class HlmToast {
	public readonly tone = input<ToastTone>('success');
	public readonly message = input.required<string>();
	/** L'action en icône ; sans elle, l'icône ferme le toast. */
	public readonly action = input<ToastAction>();
	/** L'identifiant donné par `showToast()`, pour se fermer. */
	public readonly toastId = input<string | number>();

	protected readonly _icone = computed(() => icones[this.tone()]);
	protected readonly _iconeFermer = matCloseOutline;

	constructor() {
		// Dans la pile de sonner, la largeur de son conteneur (`--width`) ; seul, celle de son parent.
		classes(() => ['flex w-full items-center in-data-sonner-toast:w-(--width) justify-between gap-space-sm rounded-md p-space-md', fonds[this.tone()]]);
	}

	protected _agir(): void {
		this.action()?.onClick?.();
		const id = this.toastId();
		if (id !== undefined) toast.dismiss(id);
	}
}

export interface ShowToastOptions {
	tone?: ToastTone;
	message: string;
	action?: ToastAction;
	/** En millisecondes ; 4 s par défaut. */
	duration?: number;
}

let prochainId = 0;

/** Affiche un `Toast` dans le `hlm-toaster` de l'application ; renvoie son identifiant. */
export function showToast({ tone = 'success', message, action, duration }: ShowToastOptions): string {
	const id = `hlm-toast-${prochainId++}`;
	toast.custom(HlmToast, {
		id,
		duration,
		componentProps: { tone, message, action, toastId: id },
	});
	return id;
}
