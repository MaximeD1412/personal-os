import type { BooleanInput } from '@angular/cdk/coercion';
import {
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	input,
	linkedSignal,
	model,
	output,
	viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { matCheckOutline } from '@ng-icons/material-symbols/outline';
import { BrnCheckbox } from '@spartan-ng/brain/checkbox';
import { BrnFieldControlDescribedBy } from '@spartan-ng/brain/field';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import { hlm } from '@personal-os/ui/utils';
import type { ClassValue } from 'clsx';

export const HLM_CHECKBOX_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => HlmCheckbox),
	multi: true,
};

@Component({
	selector: 'hlm-checkbox',
	imports: [BrnCheckbox, NgIcon],
	providers: [HLM_CHECKBOX_VALUE_ACCESSOR],
	viewProviders: [provideIcons({ matCheckOutline })],
	changeDetection: ChangeDetectionStrategy.OnPush,
	hostDirectives: [BrnFieldControlDescribedBy],
	host: {
		class: 'contents peer',
		'data-slot': 'checkbox',
		'[attr.aria-label]': 'null',
		'[attr.aria-labelledby]': 'null',
		'[attr.data-disabled]': '_disabled() ? "" : null',
	},
	template: `
		<brn-checkbox
			[id]="inputId()"
			[name]="name()"
			[class]="_computedClass()"
			[checked]="checked()"
			[(indeterminate)]="indeterminate"
			[disabled]="_disabled()"
			[required]="required()"
			[aria-label]="ariaLabel()"
			[aria-labelledby]="ariaLabelledby()"
			[aria-describedby]="ariaDescribedby()"
			[forceInvalid]="forceInvalid()"
			(checkedChange)="_handleChange($event)"
			(touched)="_onTouched?.()"
		>
			@if (checked() || indeterminate()) {
				<span class="[&>ng-icon]:icon-xs flex items-center justify-center text-current transition-none">
					<ng-icon name="matCheckOutline" />
				</span>
			}
		</brn-checkbox>
	`,
})
export class HlmCheckbox implements ControlValueAccessor {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });

	protected readonly _computedClass = computed(() =>
		hlm(
			// Le master `Checkbox` (02 Forms) : case de 18 px au rayon 4, bordure
			// 1,5 px `outline-variant` sur `surface-container-lowest` ; cochée, fond
			// `primary` et coche `on-primary`.
			'peer flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border-[1.5px] border-outline-variant bg-surface-container-lowest text-on-primary outline-none transition-colors hover:border-outline focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary-20 data-checked:border-primary data-checked:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[matches-spartan-invalid=true]:border-error disabled:cursor-not-allowed disabled:opacity-40 group-has-disabled/field:opacity-40',
			this.userClass(),
			this._errorStateClass(),
		),
	);

	/** Used to set the id on the underlying brn element. */
	public readonly inputId = input<string | null>(null);

	/** Used to set the aria-label attribute on the underlying brn element. */
	public readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });

	/** Used to set the aria-labelledby attribute on the underlying brn element. */
	public readonly ariaLabelledby = input<string | null>(null, { alias: 'aria-labelledby' });

	/** Used to set the aria-describedby attribute on the underlying brn element. */
	public readonly ariaDescribedby = input<string | null>(null, { alias: 'aria-describedby' });

	/** The checked state of the checkbox. */
	public readonly checkedInput = input<boolean, BooleanInput>(false, { alias: 'checked', transform: booleanAttribute });
	public readonly checked = linkedSignal(this.checkedInput);

	/** Emits when checked state changes. */
	public readonly checkedChange = output<boolean>();

	/**
	 * The indeterminate state of the checkbox.
	 * For example, a "select all/deselect all" checkbox may be in the indeterminate state when some but not all of its sub-controls are checked.
	 */
	public readonly indeterminate = model<boolean>(false);

	/** The name attribute of the checkbox. */
	public readonly name = input<string | null>(null);

	/** Whether the checkbox is required. */
	public readonly required = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	/** Whether the checkbox is disabled. */
	public readonly disabled = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	/** Whether to force the checkbox into an invalid state. */
	public readonly forceInvalid = input<boolean, BooleanInput>(false, { transform: booleanAttribute });

	protected readonly _disabled = linkedSignal(this.disabled);

	private readonly _brnCheckbox = viewChild.required(BrnCheckbox);

	private readonly _spartanInvalid = computed(() => this.forceInvalid() || this._brnCheckbox().spartanInvalid?.());
	protected readonly _errorStateClass = computed(() =>
		this._spartanInvalid()
			? 'border-error focus-visible:border-error focus-visible:ring-error-20'
			: '',
	);

	protected _onChange?: ChangeFn<boolean>;
	protected _onTouched?: TouchFn;

	protected _handleChange(value: boolean): void {
		if (this._disabled()) return;
		this.checked.set(value);
		this.checkedChange.emit(value);
		this._onChange?.(value);
	}

	/** CONTROL VALUE ACCESSOR */
	writeValue(value: boolean): void {
		this.checked.set(value);
	}

	registerOnChange(fn: ChangeFn<boolean>): void {
		this._onChange = fn;
	}

	registerOnTouched(fn: TouchFn): void {
		this._onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this._disabled.set(isDisabled);
	}
}
