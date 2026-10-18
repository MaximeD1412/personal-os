import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BrnAvatar } from '@spartan-ng/brain/avatar';
import { classes } from '@personal-os/ui/utils';

/** La tonalité du master `Avatar` : `primary` (défaut), `secondary`, `neutral`. */
export type HlmAvatarTone = 'primary' | 'secondary' | 'neutral';

/**
 * Le master `Avatar` : une capsule de 24 (`sm`), 32 (`default`) ou 40 px
 * (`lg`), qui porte une icône ou des initiales (`hlmAvatarFallback`), ou une
 * image.
 */
@Component({
	selector: 'hlm-avatar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'avatar',
		'[attr.data-size]': 'size()',
		'[attr.data-tone]': 'tone()',
	},
	template: `
		@if (_image()?.canShow()) {
			<ng-content select="[hlmAvatarImage],[brnAvatarImage]" />
		} @else {
			<ng-content select="[hlmAvatarFallback],[brnAvatarFallback]" />
		}
		<ng-content />
	`,
})
export class HlmAvatar extends BrnAvatar {
	public readonly size = input<'default' | 'sm' | 'lg'>('default');
	public readonly tone = input<HlmAvatarTone>('primary');

	constructor() {
		super();
		classes(
			() =>
				'group/avatar relative flex size-8 shrink-0 select-none rounded-full data-[size=lg]:size-10 data-[size=sm]:size-6',
		);
	}
}
