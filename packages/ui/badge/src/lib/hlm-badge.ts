import { afterNextRender, booleanAttribute, Directive, ElementRef, inject, input, isDevMode } from '@angular/core';
import { classes } from '@personal-os/ui/utils';
import { type VariantProps, cva } from 'class-variance-authority';

// Les masters `Badge` (statut en capsule) et `Tag` (mot-clé) de la planche
// 03 Data Display. Une tonalité est un sens, pas une teinte : validé
// (`success`), en attente (`warning`), alerte (`error`), information (`info`),
// neutre (`neutral`) — la table est dans docs/design-system.md.
const badgeVariants = cva(
	'inline-flex w-fit shrink-0 items-center justify-center gap-space-xs overflow-hidden whitespace-nowrap px-space-sm py-0.5 text-label-micro font-semibold tracking-normal tabular-nums [&>ng-icon]:icon-xs [&>ng-icon]:shrink-0 data-[dot=true]:before:size-1.5 data-[dot=true]:before:shrink-0 data-[dot=true]:before:rounded-full data-[dot=true]:before:bg-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
	{
		variants: {
			variant: {
				badge: 'rounded-full',
				tag: 'rounded-sm bg-surface-container-high font-medium text-on-surface-variant',
				counter: 'h-4 min-w-4 rounded-full px-1 py-0 font-bold',
			},
			tone: {
				info: '',
				success: '',
				warning: '',
				error: '',
				neutral: '',
			},
			accent: { true: '', false: '' },
			solid: { true: '', false: '' },
		},
		compoundVariants: [
			{ variant: ['badge', 'counter'], solid: false, tone: 'info', class: 'bg-primary-20 text-primary' },
			{ variant: ['badge', 'counter'], solid: false, tone: 'success', class: 'bg-secondary-20 text-secondary' },
			{ variant: ['badge', 'counter'], solid: false, tone: 'warning', class: 'bg-tertiary-15 text-tertiary' },
			{ variant: ['badge', 'counter'], solid: false, tone: 'error', class: 'bg-error-20 text-error' },
			{
				variant: ['badge', 'counter'],
				solid: false,
				tone: 'neutral',
				class: 'bg-surface-container-high text-on-surface-variant',
			},
			{ variant: 'counter', solid: true, class: 'bg-primary-container px-1.5 text-on-primary-container' },
			{ variant: 'tag', accent: true, class: 'text-primary' },
		],
		defaultVariants: {
			variant: 'badge',
			tone: 'info',
			accent: false,
			solid: false,
		},
	},
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
export type BadgeVariant = NonNullable<BadgeVariants['variant']>;
export type BadgeTone = NonNullable<BadgeVariants['tone']>;

/**
 * Un statut (`variant="badge"`, par défaut), un mot-clé (`variant="tag"`) ou un
 * compteur (`variant="counter"`). Le contenu projeté est le libellé, précédé
 * au besoin d'une `ng-icon` ; un statut ne passe jamais par la couleur seule.
 */
@Directive({
	selector: '[hlmBadge],hlm-badge',
	host: {
		'data-slot': 'badge',
		'[attr.data-variant]': 'variant()',
		'[attr.data-tone]': 'variant() === "tag" ? null : tone()',
		'[attr.data-dot]': 'dot() ? "true" : null',
	},
})
export class HlmBadge {
	/** `badge` : statut en capsule ; `tag` : mot-clé au rayon 4 ; `counter` : compteur de 16 px. */
	public readonly variant = input<BadgeVariant>('badge');
	/** Le sens du statut (badge et compteur). */
	public readonly tone = input<BadgeTone>('info');
	/** Un point de 6 px avant le libellé, dans la couleur du texte. */
	public readonly dot = input(false, { transform: booleanAttribute });
	/** Tag accentué : texte `primary`. */
	public readonly accent = input(false, { transform: booleanAttribute });
	/** Compteur plein : fond `primary-container`. */
	public readonly solid = input(false, { transform: booleanAttribute });

	constructor() {
		classes(() =>
			badgeVariants({ variant: this.variant(), tone: this.tone(), accent: this.accent(), solid: this.solid() }),
		);

		if (isDevMode()) {
			const hote = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
			afterNextRender(() => {
				if (!hote.textContent?.trim() && !hote.querySelector('ng-icon')) {
					console.error(
						'HlmBadge : un statut ne passe jamais par la couleur seule, donne-lui un libellé ou une icône.',
						hote,
					);
				}
			});
		}
	}
}
