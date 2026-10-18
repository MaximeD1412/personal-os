import type { BooleanInput } from '@angular/cdk/coercion';
import {
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	computed,
	HOST_TAG_NAME,
	inject,
	input,
	signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matProgressActivityOutline } from '@ng-icons/material-symbols/outline';
import { classes } from '@personal-os/ui/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ClassValue } from 'clsx';
import { injectBrnButtonConfig } from './hlm-button.token';

/**
 * Les masters `Button/*` de la planche `01 Actions` : une variante par master,
 * la taille est un preset (hauteur, padding, typographie, icône). Survol et
 * pression suivent les galeries d'états, sauf le pressé du primaire : pas de
 * `primary-container` sous un texte (UI-5), seulement l'échelle 0,98.
 */
export const buttonVariants = cva(
	[
		'group/button inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded border border-transparent font-semibold outline-none select-none',
		'transition-[color,background-color,border-color,box-shadow,scale,opacity]',
		'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-20',
		'active:not-data-[disabled]:scale-98',
		'data-[disabled]:cursor-not-allowed data-[disabled]:not-data-[loading]:opacity-40 data-[loading]:opacity-70',
		'[&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0 data-[loading]:[&>[data-slot=spinner]+ng-icon]:hidden',
	],
	{
		variants: {
			variant: {
				primary: 'bg-primary text-on-primary hover:not-data-[disabled]:bg-primary-fixed',
				secondary:
					'bg-surface-container-high border-surface-container-highest text-on-surface hover:not-data-[disabled]:border-primary hover:not-data-[disabled]:text-primary active:not-data-[disabled]:bg-surface-container-highest',
				ghost: 'text-on-surface-variant hover:not-data-[disabled]:bg-surface-container active:not-data-[disabled]:bg-surface-container-high',
				destructive:
					'bg-error-20 border-error-stroke-30 text-error hover:not-data-[disabled]:bg-error-container hover:not-data-[disabled]:text-on-error-container active:not-data-[disabled]:bg-error-40',
				link: 'text-primary underline-offset-4 hover:not-data-[disabled]:underline',
			},
			size: {
				sm: 'h-7 gap-2 px-3 text-label-regular [&_ng-icon]:icon-xs',
				md: 'h-9 gap-2 px-4 text-body-dense [&_ng-icon]:icon-sm',
				lg: 'h-10 gap-2 px-5 text-title-sm [&_ng-icon]:icon-sm',
				icon: 'size-9 [&_ng-icon]:icon-sm',
				'icon-lg': 'size-11 [&_ng-icon]:icon-md',
			},
			fullWidth: {
				true: 'w-full',
				false: '',
			},
		},
		compoundVariants: [
			// `Button/Icon` rempli (`filled`) : le fond du secondaire, sans sa bordure.
			{
				variant: 'secondary',
				size: ['icon', 'icon-lg'],
				class: 'border-transparent text-on-surface-variant hover:not-data-[disabled]:border-transparent hover:not-data-[disabled]:bg-surface-container-highest hover:not-data-[disabled]:text-on-surface',
			},
			// `Button/Link` : un texte, sans boîte ; la taille ne s'y applique pas.
			{
				variant: 'link',
				class: 'h-auto gap-1 p-0 text-label-regular [&_ng-icon]:icon-2xs',
			},
		],
		defaultVariants: {
			variant: 'primary',
			size: 'md',
			fullWidth: false,
		},
	},
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;

/**
 * Le bouton du design system, sur `<button>` ou `<a>`. Les icônes de tête et
 * de fin sont des `ng-icon` placés avant ou après le libellé ; un bouton
 * d'icône seule (`size="icon"`) porte un `aria-label`.
 *
 * `loading` remplace l'icône de tête par un indicateur et désactive le bouton.
 */
@Component({
	// Un composant posé sur `<button>` et `<a>`, comme la directive de spartan
	// qu'il remplace : il porte l'indicateur de chargement.
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: 'button[hlmBtn], a[hlmBtn]',
	exportAs: 'hlmBtn',
	imports: [NgIcon],
	providers: [provideIcons({ matProgressActivityOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'button',
		'[attr.disabled]': '!_isAnchor && _disabled() ? true : null',
		'[attr.data-disabled]': '_disabled() ? true : null',
		'[attr.aria-disabled]': '_isAnchor && _disabled() ? true : null',
		'[attr.tabindex]': '_isAnchor && _disabled() ? -1 : null',
		'[attr.data-loading]': 'loading() ? true : null',
		'[attr.aria-busy]': 'loading() ? true : null',
		'(click)': '_bloquerSiDesactive($event)',
	},
	template: `
		@if (loading()) {
			<ng-icon data-slot="spinner" name="matProgressActivityOutline" class="animate-spin" aria-hidden="true" />
		}
		<ng-content />
	`,
})
export class HlmButton {
	private readonly _config = injectBrnButtonConfig();

	private readonly _additionalClasses = signal<ClassValue>('');

	protected readonly _isAnchor = inject(HOST_TAG_NAME) === 'a';

	public readonly variant = input<ButtonVariants['variant']>(this._config.variant);

	public readonly size = input<ButtonVariants['size']>(this._config.size);

	/** Occupe toute la largeur de son conteneur. */
	public readonly fullWidth = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	public readonly disabled = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	/** Une action en cours : l'indicateur remplace l'icône de tête, le bouton est désactivé. */
	public readonly loading = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	protected readonly _disabled = computed(() => this.disabled() || this.loading());

	constructor() {
		classes(() => [
			buttonVariants({ variant: this.variant(), size: this.size(), fullWidth: this.fullWidth() }),
			this._additionalClasses(),
		]);
	}

	setClass(classes: string): void {
		this._additionalClasses.set(classes);
	}

	/** Un lien n'a pas d'attribut `disabled` : son clic est annulé ici. */
	protected _bloquerSiDesactive(event: Event): void {
		if (!this._disabled()) return;
		event.preventDefault();
		event.stopImmediatePropagation();
	}
}
