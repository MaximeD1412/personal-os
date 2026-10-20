import {
  matCakeOutline,
  matEventNoteOutline,
  matFlagOutline,
  matScheduleOutline,
} from '@ng-icons/material-symbols/outline';
import type { EventCategory } from '@personal-os/contracts';

/** Une catégorie d'Événement telle que l'écran la montre. */
export interface CategorieDEvenement {
  valeur: EventCategory;
  libelle: string;
  /** L'icône, en SVG (`ng-icon [svg]`). */
  icone: string;
  /** Le fond et le filet d'une pastille de la grille, d'une carte du jour. */
  teinte: string;
  /** La couleur de l'icône et du point du bandeau. */
  encre: string;
  point: string;
}

/**
 * Les catégories du contrat, dans l'ordre où l'écran les propose. Une
 * Échéance est en `error` : c'est ce qui ne se rattrape pas.
 */
export const CATEGORIES: readonly CategorieDEvenement[] = [
  {
    valeur: 'APPOINTMENT',
    libelle: 'Rendez-vous',
    icone: matScheduleOutline,
    teinte: 'bg-primary-10 border-s-primary',
    encre: 'text-primary',
    point: 'bg-primary',
  },
  {
    valeur: 'BIRTHDAY',
    libelle: 'Anniversaire',
    icone: matCakeOutline,
    teinte: 'bg-tertiary-15 border-s-tertiary',
    encre: 'text-tertiary',
    point: 'bg-tertiary',
  },
  {
    valeur: 'DEADLINE',
    libelle: 'Échéance',
    icone: matFlagOutline,
    teinte: 'bg-error-20 border-s-error',
    encre: 'text-error',
    point: 'bg-error',
  },
  {
    valeur: 'OTHER',
    libelle: 'Autre',
    icone: matEventNoteOutline,
    teinte: 'bg-surface-container-high border-s-outline',
    encre: 'text-outline',
    point: 'bg-outline',
  },
];

export function categorieDe(valeur: EventCategory): CategorieDEvenement {
  return (
    CATEGORIES.find((categorie) => categorie.valeur === valeur) ??
    CATEGORIES[CATEGORIES.length - 1]
  );
}
