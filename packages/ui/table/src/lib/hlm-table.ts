import { Directive } from '@angular/core';
import { classes } from '@personal-os/ui/utils';

@Directive({
	selector: 'div[hlmTableContainer]',
	host: { 'data-slot': 'table-container' },
})
export class HlmTableContainer {
	constructor() {
		classes(() => 'relative w-full overflow-x-auto rounded border border-surface-container-highest');
	}
}

/**
 * Directive to apply the pen.dev styling to a <table> element.
 */
@Directive({
	selector: 'table[hlmTable]',
	host: { 'data-slot': 'table' },
})
export class HlmTable {
	constructor() {
		classes(() => 'w-full caption-bottom text-body-dense');
	}
}

/**
 * Directive to apply the pen.dev styling to a <thead> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'thead[hlmTHead],thead[hlmTableHeader]',
	host: { 'data-slot': 'table-header' },
})
export class HlmTHead {
	constructor() {
		classes(() => 'bg-surface-container-lowest [&_tr]:border-b [&_tr]:border-surface-container-high [&_tr]:hover:bg-transparent');
	}
}

/**
 * Directive to apply the pen.dev styling to a <tbody> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'tbody[hlmTBody],tbody[hlmTableBody]',
	host: { 'data-slot': 'table-body' },
})
export class HlmTBody {
	constructor() {
		classes(() => '[&_tr:last-child]:border-0');
	}
}

/**
 * Directive to apply the pen.dev styling to a <tfoot> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'tfoot[hlmTFoot],tfoot[hlmTableFooter]',
	host: { 'data-slot': 'table-footer' },
})
export class HlmTFoot {
	constructor() {
		classes(() => 'border-t border-surface-container-high bg-surface-container-low font-semibold [&>tr]:last:border-b-0');
	}
}

/**
 * Directive to apply the pen.dev styling to a <tr> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'tr[hlmTr],tr[hlmTableRow]',
	host: { 'data-slot': 'table-row' },
})
export class HlmTr {
	constructor() {
		classes(() => 'border-b border-surface-container-high transition-colors hover:bg-surface-container-high data-[state=selected]:bg-primary-10 has-aria-expanded:bg-surface-container-high');
	}
}

/**
 * `Table/HeaderCell` : `label-micro` en capitales, `outline`.
 *
 * Directive to apply the pen.dev styling to a <th> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'th[hlmTh],th[hlmTableHead]',
	host: { 'data-slot': 'table-head' },
})
export class HlmTh {
	constructor() {
		classes(() => 'px-space-sm py-2.5 text-start align-middle text-label-micro whitespace-nowrap text-outline uppercase [&:has([role=checkbox])]:pe-0');
	}
}

/**
 * `Table/Cell` : `body-dense`, `on-surface-variant` ; la cellule principale
 * d'une ligne passe en `on-surface` 600 (`font-semibold text-on-surface`).
 *
 * Directive to apply the pen.dev styling to a <td> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'td[hlmTd],td[hlmTableCell]',
	host: { 'data-slot': 'table-cell' },
})
export class HlmTd {
	constructor() {
		classes(() => 'px-space-sm py-space-md align-middle text-body-dense whitespace-nowrap text-on-surface-variant [&:has([role=checkbox])]:pe-0');
	}
}

/**
 * Directive to apply the pen.dev styling to a <caption> element
 * within an HlmTable context.
 */
@Directive({
	selector: 'caption[hlmCaption],caption[hlmTableCaption]',
	host: { 'data-slot': 'table-caption' },
})
export class HlmCaption {
	constructor() {
		classes(() => 'mt-space-md text-body-dense text-outline');
	}
}
