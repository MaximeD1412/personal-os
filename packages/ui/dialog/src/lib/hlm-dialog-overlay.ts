import { computed, Directive, effect, input, untracked } from '@angular/core';
import { injectCustomClassSettable } from '@spartan-ng/brain/core';
import { BrnDialogOverlay } from '@spartan-ng/brain/dialog';
import { hlm } from '@personal-os/ui/utils';
import type { ClassValue } from 'clsx';
import { hlmModalOverlayClass } from './hlm-dialog-classes';

export const hlmDialogOverlayClass = hlm(hlmModalOverlayClass);

@Directive({
	selector: '[hlmDialogOverlay],hlm-dialog-overlay',
	hostDirectives: [BrnDialogOverlay],
})
export class HlmDialogOverlay {
	private readonly _classSettable = injectCustomClassSettable({ optional: true, host: true });

	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() => hlm(hlmDialogOverlayClass, this.userClass()));

	constructor() {
		effect(() => {
			const newClass = this._computedClass();
			untracked(() => this._classSettable?.setClassToCustomElement(newClass));
		});
	}
}
