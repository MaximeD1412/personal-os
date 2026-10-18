import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matKeyboardArrowDownOutline } from '@ng-icons/material-symbols/outline';
import { BrnSelectScrollDown } from '@spartan-ng/brain/select';
import { classes } from '@personal-os/ui/utils';

@Component({
	selector: 'hlm-select-scroll-down',
	imports: [NgIcon],
	providers: [provideIcons({ matKeyboardArrowDownOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [BrnSelectScrollDown],
	template: `
		<ng-icon name="matKeyboardArrowDownOutline" />
	`,
})
export class HlmSelectScrollDown {
	constructor() {
		classes(() => "bg-surface-container-high text-outline [&_ng-icon]:icon-xs z-10 flex cursor-default items-center justify-center py-1 sticky bottom-0 w-full data-hidden:hidden");
	}
}
