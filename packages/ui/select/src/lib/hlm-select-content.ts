import { BooleanInput } from '@angular/cdk/coercion';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BrnSelectContent } from '@spartan-ng/brain/select';
import { classes, hlm } from '@personal-os/ui/utils';
import { HlmSelectScrollDown } from './hlm-select-scroll-down';
import { HlmSelectScrollUp } from './hlm-select-scroll-up';

@Component({
	selector: 'hlm-select-content',
	imports: [HlmSelectScrollUp, HlmSelectScrollDown],
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [BrnSelectContent],
	template: `
		@if (showScroll()) {
			<hlm-select-scroll-up />
		}

		<div role="listbox" [class]="_computedListboxClasses()">
			<ng-content />
		</div>

		@if (showScroll()) {
			<hlm-select-scroll-down />
		}
	`,
})
export class HlmSelectContent {
	protected readonly _computedListboxClasses = computed(() => hlm('flex flex-col'));

	public readonly showScroll = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	constructor() {
		classes(() => 'bg-surface-container-high text-on-surface border-surface-container-highest shadow-popover no-scrollbar data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative flex max-h-72 w-(--brn-select-width) min-w-36 flex-col overflow-x-hidden overflow-y-auto rounded border duration-100');
	}
}
