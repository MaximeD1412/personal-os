import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LANGUES, type Langue } from './langue';
import { TEXTES } from './textes';

/** Ce qu'une page dit d'elle-même aux moteurs et aux aperçus de liens. */
export interface DescriptionDePage {
  readonly langue: Langue;
  /** Le titre propre à la page ; la marque s'y ajoute. Absent : la marque seule. */
  readonly titre?: string;
  /** Absente : la description générale de l'interface, dans cette langue. */
  readonly description?: string;
  readonly type: 'website' | 'article';
  /**
   * Le chemin de la page dans chaque langue où elle existe, la sienne
   * comprise. Vide : la page n'existe pas, elle sort de l'index.
   */
  readonly versions: Partial<Record<Langue, string>>;
  /** Le chemin qui choisit la langue du visiteur (`x-default`). */
  readonly parDefaut?: string;
}

/** La longueur qu'un moteur affiche d'une description. */
const LONGUEUR_DE_DESCRIPTION = 160;

/**
 * Les métadonnées du document : `title`, `description`, Open Graph, l'URL
 * canonique et les `hreflang`. Chaque page les pose en entier, si bien que
 * rien ne reste de la précédente.
 */
@Injectable({ providedIn: 'root' })
export class Metadonnees {
  private readonly document = inject(DOCUMENT);
  private readonly titre = inject(Title);
  private readonly meta = inject(Meta);

  poser(page: DescriptionDePage): void {
    const textes = TEXTES[page.langue];
    const titre = page.titre
      ? `${page.titre} — ${textes.marque}`
      : textes.marque;
    const description = abreger(page.description?.trim() || textes.description);
    const chemin = page.versions[page.langue];
    const autres = LANGUES.filter((langue) => langue !== page.langue);

    this.titre.setTitle(titre);
    this.nommee('description', description);
    this.nommee('robots', chemin ? null : 'noindex');
    this.propriete('og:title', titre);
    this.propriete('og:description', description);
    this.propriete('og:type', page.type);
    this.propriete('og:site_name', textes.marque);
    this.propriete('og:locale', localeOpenGraph(page.langue));
    this.propriete(
      'og:locale:alternate',
      autres.some((langue) => page.versions[langue])
        ? localeOpenGraph(autres[0])
        : null,
    );
    this.propriete('og:url', chemin ? this.absolue(chemin) : null);

    this.retirerLesLiens();
    if (!chemin) {
      return;
    }
    this.lier({ rel: 'canonical', href: this.absolue(chemin) });
    for (const langue of LANGUES) {
      const version = page.versions[langue];
      if (version) {
        this.lier({
          rel: 'alternate',
          hreflang: langue,
          href: this.absolue(version),
        });
      }
    }
    if (page.parDefaut) {
      this.lier({
        rel: 'alternate',
        hreflang: 'x-default',
        href: this.absolue(page.parDefaut),
      });
    }
  }

  private nommee(nom: string, valeur: string | null): void {
    this.poserLaBalise('name', nom, valeur);
  }

  private propriete(nom: string, valeur: string | null): void {
    this.poserLaBalise('property', nom, valeur);
  }

  private poserLaBalise(
    attribut: 'name' | 'property',
    nom: string,
    valeur: string | null,
  ): void {
    const selecteur = `${attribut}="${nom}"`;
    if (valeur === null) {
      this.meta.removeTag(selecteur);
    } else {
      this.meta.updateTag({ [attribut]: nom, content: valeur }, selecteur);
    }
  }

  private lier(attributs: Record<string, string>): void {
    const lien = this.document.createElement('link');
    for (const [nom, valeur] of Object.entries(attributs)) {
      lien.setAttribute(nom, valeur);
    }
    lien.setAttribute('data-metadonnee', '');
    this.document.head.appendChild(lien);
  }

  private retirerLesLiens(): void {
    this.document.head
      .querySelectorAll('link[data-metadonnee]')
      .forEach((lien) => lien.remove());
  }

  private absolue(chemin: string): string {
    return new URL(chemin, this.document.location.origin).href;
  }
}

/** `fr_FR`, `en_GB` : la locale d'Open Graph, tirée de celle de l'interface. */
function localeOpenGraph(langue: Langue): string {
  return TEXTES[langue].locale.replace('-', '_');
}

/**
 * Une description ramenée à la longueur qu'un moteur en affiche, coupée
 * entre deux mots.
 */
export function abreger(texte: string): string {
  if (texte.length <= LONGUEUR_DE_DESCRIPTION) {
    return texte;
  }
  const coupe = texte.slice(0, LONGUEUR_DE_DESCRIPTION - 1);
  const espace = coupe.lastIndexOf(' ');
  return `${(espace > 0 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}
