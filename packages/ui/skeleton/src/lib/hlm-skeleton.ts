import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

/**
 * Le master `Skeleton` : un os `surface-container-highest` au rayon 4, que
 * traverse un reflet (`animate-shimmer`, arrêté quand le système demande
 * moins d'animations). Sa taille est celle du contenu attendu : l'écran la
 * donne (`class="h-3.5 w-55"`). Un os n'est pas lu : le conteneur qui attend
 * porte `aria-busy` et un libellé.
 */
@Directive({
	selector: '[hlmSkeleton],hlm-skeleton',
	host: {
		'data-slot': 'skeleton',
		'aria-hidden': 'true',
	},
})
export class HlmSkeleton {
	constructor() {
		classes(() => [
			'relative block overflow-hidden rounded-sm bg-surface-container-highest',
			'after:absolute after:inset-0 after:-translate-x-full after:bg-linear-to-r after:from-transparent after:via-surface-bright after:to-transparent after:opacity-40 motion-safe:after:animate-shimmer',
		]);
	}
}
