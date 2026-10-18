/** Les deux hauteurs du master `Input` : 36 (par défaut) et 40. */
export type InputSize = 'md' | 'lg';

export const inputSizeClasses: Record<InputSize, string> = {
	md: 'h-9',
	lg: 'h-10',
};

/**
 * La boîte du master `Input` et ses états : survol (bordure
 * `outline-variant`), focus (bordure `primary`, anneau `primary-20`), erreur
 * (bordure `error`, dès que le contrôle est invalide et touché, ou forcé par
 * `forceInvalid`), désactivé (40 %). Le déclencheur du Select la reprend.
 */
export const inputBoxClasses = [
	'bg-surface-container-lowest border-surface-container-highest text-body-default text-on-surface rounded border outline-none transition-[border-color,box-shadow,opacity]',
	'[&:hover:not(:focus-visible,:disabled,[data-matches-spartan-invalid=true])]:border-outline-variant',
	'focus-visible:ring-primary-20 focus-visible:ring-2 focus-visible:not-data-[matches-spartan-invalid=true]:border-primary',
	'data-[matches-spartan-invalid=true]:border-error',
	'disabled:cursor-not-allowed disabled:opacity-40',
];
