import type { BooleanInput } from '@angular/cdk/coercion';
import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matKeyboardArrowDownOutline } from '@ng-icons/material-symbols/outline';
import { BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
import { BrnSelectTrigger } from '@spartan-ng/brain/select';
import { inputBoxClasses, type InputSize, inputSizeClasses } from '@personal-os/ui/input';
import { hlm } from '@personal-os/ui/utils';
import type { ClassValue } from 'clsx';

@Component({
	selector: 'hlm-select-trigger',
	imports: [NgIcon, BrnSelectTrigger, BrnFieldControlDescribedBy],
	providers: [provideIcons({ matKeyboardArrowDownOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<button
			brnSelectTrigger
			brnFieldControlDescribedBy
			[forceInvalid]="forceInvalid()"
			[id]="buttonId()"
			[class]="_computedClass()"
			[attr.data-size]="size()"
			data-slot="select-trigger"
		>
			<ng-content />
			<ng-icon name="matKeyboardArrowDownOutline" class="text-outline icon-sm ms-auto" />
		</button>
	`,
})
export class HlmSelectTrigger {
	private static _id = 0;

	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() =>
		hlm(
			inputBoxClasses,
			inputSizeClasses[this.size()],
			'data-placeholder:text-outline flex w-fit cursor-pointer items-center justify-between gap-2 px-3 whitespace-nowrap *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_ng-icon]:pointer-events-none [&_ng-icon]:shrink-0',
			this.userClass(),
		),
	);

	public readonly buttonId = input<string>(`hlm-select-trigger-${HlmSelectTrigger._id++}`);

	/** Les hauteurs du master `Input`, dont le Select reprend l'apparence. */
	public readonly size = input<InputSize>('md');

	/** Whether to force the trigger into an invalid state. */
	public readonly forceInvalid = input<boolean, BooleanInput>(false, { transform: booleanAttribute });
}
