/**
 * Le master `Modal` de la planche `05 Feedback`, partagé par `hlm-dialog` et
 * `hlm-alert-dialog` : 520 de large, `surface-container-high` (UI-3 suit la
 * Foundations, « Modale / popover », plutôt que le `surface-container` du
 * master), bordure `outline-variant`, ombre de popover. En-tête bordé, contenu
 * à 20, pied `surface-container-lowest`.
 */
export const hlmModalContentClass =
	'relative mx-auto flex w-[calc(100vw-2rem)] max-w-130 flex-col overflow-hidden rounded-md border border-outline-variant bg-surface-container-high text-body-dense text-on-surface shadow-popover outline-none data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 duration-100';

export const hlmModalHeaderClass =
	'flex flex-col gap-0.5 border-b border-surface-container-highest px-space-lg py-gutter text-start';

export const hlmModalTitleClass = 'text-headline-md text-on-surface';

export const hlmModalDescriptionClass = 'text-body-dense text-outline';

export const hlmModalBodyClass = 'flex flex-col gap-space-md p-space-lg text-body-dense text-on-surface-variant';

export const hlmModalFooterClass =
	'flex flex-col-reverse gap-space-sm bg-surface-container-lowest px-space-lg py-space-md sm:flex-row sm:justify-end';

/** Le voile sous une modale : celui de la barre de commande et du panneau « Plus ». */
export const hlmModalOverlayClass =
	'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 isolate bg-surface-container-lowest-80 duration-100 supports-backdrop-filter:backdrop-blur-xs';
