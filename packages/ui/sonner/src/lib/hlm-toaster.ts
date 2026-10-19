import type { BooleanInput, NumberInput } from '@angular/cdk/coercion';
import { ChangeDetectionStrategy, Component, booleanAttribute, input, numberAttribute } from '@angular/core';
import { BrnSonnerImports, type ToasterProps } from '@spartan-ng/brain/sonner';

/**
 * Le conteneur des toasts, posé une fois par l'application. Les toasts du
 * design system passent par `showToast()`, qui rend `hlm-toast` : sonner n'en
 * gère que la pile, la durée, le balayage et le raccourci (Alt+T).
 */
@Component({
	selector: 'hlm-toaster',
	imports: [BrnSonnerImports],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<brn-sonner-toaster
			class="toaster group"
			theme="dark"
			[position]="position()"
			[hotKey]="hotKey()"
			[expand]="expand()"
			[duration]="duration()"
			[visibleToasts]="visibleToasts()"
			[offset]="offset()"
			[style]="_style"
		/>
	`,
})
export class HlmToaster {
	public readonly position = input<ToasterProps['position']>('bottom-right');
	public readonly hotKey = input<ToasterProps['hotkey']>(['altKey', 'KeyT']);
	public readonly expand = input<ToasterProps['expand'], BooleanInput>(false, {
		transform: booleanAttribute,
	});
	public readonly duration = input<ToasterProps['duration'], NumberInput>(4000, {
		transform: numberAttribute,
	});
	public readonly visibleToasts = input<ToasterProps['visibleToasts'], NumberInput>(3, {
		transform: numberAttribute,
	});
	public readonly offset = input<ToasterProps['offset']>(null);

	// Un toast posé sans `showToast()` (`toast('…')` de sonner) prend au moins
	// les surfaces du thème.
	protected readonly _style = {
		'--normal-bg': 'var(--surface-container-high)',
		'--normal-text': 'var(--on-surface)',
		'--normal-border': 'var(--outline-variant)',
		'--border-radius': 'var(--radius-md)',
	};
}
