import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matKeyboardArrowUpOutline } from '@ng-icons/material-symbols/outline';
import { BrnSelectScrollUp } from '@spartan-ng/brain/select';
import { classes } from '@personal-os/ui/utils';

@Component({
	selector: 'hlm-select-scroll-up',
	imports: [NgIcon],
	providers: [provideIcons({ matKeyboardArrowUpOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [BrnSelectScrollUp],
	template: `
		<ng-icon name="matKeyboardArrowUpOutline" />
	`,
})
export class HlmSelectScrollUp {
	constructor() {
		classes(() => "bg-surface-container-high text-outline [&_ng-icon]:icon-xs z-10 flex cursor-default items-center justify-center py-1 sticky top-0 w-full data-hidden:hidden");
	}
}
