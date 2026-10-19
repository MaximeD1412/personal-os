import { Directive, input, signal } from '@angular/core';
import { injectExposesStateProvider } from '@spartan-ng/brain/core';
import { hlmModalContentClass } from '@personal-os/ui/dialog';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: '[hlmAlertDialogContent],hlm-alert-dialog-content',
	host: {
		'data-slot': 'alert-dialog-content',
		'[attr.data-state]': 'state()',
		'[attr.data-size]': 'size()',
	},
})
export class HlmAlertDialogContent {
	private readonly _stateProvider = injectExposesStateProvider({ optional: true, host: true });
	public readonly state = this._stateProvider?.state ?? signal('closed');

	/** `sm` resserre la modale à 360 pour une question courte. */
	public readonly size = input<'sm' | 'default'>('default');

	constructor() {
		classes(() => [hlmModalContentClass, this.size() === 'sm' ? 'max-w-90' : '']);
	}
}
