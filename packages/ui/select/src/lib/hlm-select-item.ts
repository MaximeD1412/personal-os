import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCheckOutline } from '@ng-icons/material-symbols/outline';
import { BrnSelectItem } from '@spartan-ng/brain/select';
import { classes } from '@personal-os/ui/utils';

@Component({
	selector: 'hlm-select-item',
	imports: [NgIcon],
	providers: [provideIcons({ matCheckOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [{ directive: BrnSelectItem, inputs: ['id', 'disabled', 'value'] }],
	host: { 'data-slot': 'select-item' },
	template: `
		<ng-content />
		@if (_active()) {
			<ng-icon name="matCheckOutline" class="text-primary absolute end-2 flex items-center justify-center" aria-hidden="true" />
		}
	`,
})
export class HlmSelectItem {
	private readonly _brnSelectItem = inject(BrnSelectItem);

	protected readonly _active = this._brnSelectItem.active;

	constructor() {
		classes(
			() =>
				'data-highlighted:bg-surface-container-highest text-body-dense text-on-surface relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 ps-2 pe-8 outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-40 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 [&_ng-icon]:icon-xs [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0',
		);
	}
}
