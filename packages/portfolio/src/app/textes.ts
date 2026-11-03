import type { Langue } from './langue';

/**
 * Les textes de l'interface du portfolio, dans ses deux langues. Le contenu,
 * lui, vient de l'API : il est rédigé dans chaque langue, jamais traduit ni
 * remplacé par l'autre (ADR 0019).
 */
export interface Textes {
  readonly marque: string;
  readonly navigation: string;
  readonly selecteur: string;
  readonly sections: {
    readonly experience: string;
    readonly skills: string;
    readonly projets: string;
    readonly cv: string;
  };
  readonly aucunProjet: string;
  readonly lireLeProjet: string;
  readonly cvDescription: string;
  readonly telechargerLeCv: string;
  readonly chargement: string;
  readonly echec: string;
  readonly projetAbsent: string;
  readonly projetAbsentDetail: string;
  readonly retour: string;
  readonly publieLe: (jour: string) => string;
  readonly locale: string;
}

export const TEXTES: Readonly<Record<Langue, Textes>> = {
  fr: {
    marque: 'Portfolio',
    navigation: 'Sections du portfolio',
    selecteur: 'Langue du site',
    sections: {
      experience: 'Expériences',
      skills: 'Compétences',
      projets: 'Projets',
      cv: 'CV',
    },
    aucunProjet: 'Aucun projet publié pour l’instant.',
    lireLeProjet: 'Lire le projet',
    cvDescription: 'Le CV complet, au format PDF.',
    telechargerLeCv: 'Télécharger le CV (PDF)',
    chargement: 'Chargement…',
    echec: 'Le chargement a échoué',
    projetAbsent: 'Ce projet n’est pas publié en français',
    projetAbsentDetail:
      'Il n’a pas de présentation française, ou elle n’est plus en ligne.',
    retour: 'Retour au portfolio',
    publieLe: (jour) => `Publié le ${jour}`,
    locale: 'fr-FR',
  },
  en: {
    marque: 'Portfolio',
    navigation: 'Portfolio sections',
    selecteur: 'Site language',
    sections: {
      experience: 'Experience',
      skills: 'Skills',
      projets: 'Projects',
      cv: 'Resume',
    },
    aucunProjet: 'No published project yet.',
    lireLeProjet: 'Read the project',
    cvDescription: 'The full resume, as a PDF.',
    telechargerLeCv: 'Download the resume (PDF)',
    chargement: 'Loading…',
    echec: 'Loading failed',
    projetAbsent: 'This project is not published in English',
    projetAbsentDetail:
      'It has no English presentation, or it is no longer online.',
    retour: 'Back to the portfolio',
    publieLe: (jour) => `Published on ${jour}`,
    locale: 'en-GB',
  },
};
