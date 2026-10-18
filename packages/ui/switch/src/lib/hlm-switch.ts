import type { BooleanInput } from '@angular/cdk/coercion';
import {
	booleanAttribute,
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	inject,
	input,
	linkedSignal,
	output,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BrnFieldA11yService } from '@spartan-ng/brain/field';
import type { ChangeFn, TouchFn } from '@spartan-ng/brain/forms';
import { BrnSwitch, BrnSwitchThumb } from '@spartan-ng/brain/switch';
import { hlm } from '@personal-os/ui/utils';
import type { ClassValue } from 'clsx';
import { HlmSwitchThumb } from './hlm-switch-thumb';

export const HLM_SWITCH_VALUE_ACCESSOR = {
	provide: NG_VALUE_ACCESSOR,
	useExisting: forwardRef(() => HlmSwitch),
	multi: true,
};

/** Le master `Switch` : 36 × 20, pastille de 16 ; allumé en `primary`, éteint en `surface-container-highest`. */
@Component({
	selector: 'hlm-switch',
	imports: [BrnSwitchThumb, BrnSwitch, HlmSwitchThumb],
	providers: [HLM_SWITCH_VALUE_ACCESSOR],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'data-slot': 'switch',
		class: 'contents',
		'[attr.aria-label]': 'null',
		'[attr.aria-labelledby]': 'null',
		'[attr.aria-describedby]': 'null',
	},
	template: `
		<brn-switch
			[class]="_computedClass()"
			[checked]="checked()"
			(checkedChange)="handleChange($event)"
			(touched)="_onTouched?.()"
			[disabled]="_disabled()"
			[id]="inputId()"
			[aria-label]="ariaLabel()"
			[aria-labelledby]="ariaLabelledby()"
			[aria-describedby]="_describedBy()"
		>
			<brn-switch-thumb hlm />
		</brn-switch>
	`,
})
export class HlmSwitch implements ControlValueAccessor {
	public readonly userClass = input<ClassValue>('', { alias: 'class' });
	protected readonly _computedClass = computed(() =>
		hlm(
			'group/switch relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent outline-none transition-[background-color,border-color,box-shadow,opacity,scale]',
			// L'interrupteur reste à 36 × 20, sa cible tactile fait 36 × 36 (DESIGN.md).
			'after:absolute after:top-1/2 after:left-1/2 after:h-9 after:w-9 after:-translate-1/2',
			'active:not-disabled:scale-98',
			'data-checked:bg-primary data-unchecked:bg-surface-container-highest hover:not-disabled:data-checked:bg-primary-fixed hover:not-disabled:data-unchecked:bg-surface-bright',
			'focus-visible:border-primary focus-visible:ring-primary-20 focus-visible:ring-2',
			'data-[matches-spartan-invalid=true]:border-error disabled:cursor-not-allowed disabled:opacity-40',
			this.userClass(),
		),
	);

	/** The checked state of the switch. */
	public readonly checkedInput = input<boolean, BooleanInput>(false, { alias: 'checked', transform: booleanAttribute });
	public readonly checked = linkedSignal(this.checkedInput);

	/** Emits when the checked state of the switch changes. */
	public readonly checkedChange = output<boolean>();

	/** The disabled state of the switch. */
	public readonly disabled = input<boolean, BooleanInput>(false, {
		transform: booleanAttribute,
	});


	/** Used to set the id on the underlying brn element. */
	public readonly inputId = input<string | null>(null);

	/** Used to set the aria-label attribute on the underlying brn element. */
	public readonly ariaLabel = input<string | null>(null, { alias: 'aria-label' });

	/** Used to set the aria-labelledby attribute on the underlying brn element. */
	public readonly ariaLabelledby = input<string | null>(null, { alias: 'aria-labelledby' });

	/** Used to set the aria-describedby attribute on the underlying brn element. */
	public readonly ariaDescribedby = input<string | null>(null, { alias: 'aria-describedby' });

	private readonly _champ = inject(BrnFieldA11yService, { optional: true });

	/** La description donnée et celles du FormField (aide, erreur), pour le contrôle focalisable. */
	protected readonly _describedBy = computed(() => {
		const ids = [this.ariaDescribedby(), this._champ?.describedBy()]
			.flatMap((liste) => liste?.split(/\s+/) ?? [])
			.filter(Boolean);
		return ids.length ? [...new Set(ids)].join(' ') : null;
	});

	protected readonly _disabled = linkedSignal(this.disabled);

	protected _onChange?: ChangeFn<boolean>;
	protected _onTouched?: TouchFn;

	protected handleChange(value: boolean): void {
		this.checked.set(value);
		this._onChange?.(value);
		this.checkedChange.emit(value);
	}

	/** CONTROL VALUE ACCESSOR */
	writeValue(value: boolean): void {
		this.checked.set(Boolean(value));
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
